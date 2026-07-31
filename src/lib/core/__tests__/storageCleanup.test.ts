import { describe, it, expect, vi, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAiInsightCardCore, saveAiDraftCards } from "../aiInsights";
import { deleteInsightCardCore } from "../insightCards";
import { removeSessionFramesCore } from "../frames";

/**
 * NIVEL#243 — Storage cleanup for `session-frames` on card delete / re-analyze
 * / (future) whole-session delete. Local mock supabase covering exactly what
 * these three code paths touch: `insight_cards` select+delete(+update for the
 * template-id backfill loop in `saveAiDraftCards`), `rpc`, and
 * `storage.from("session-frames")` (`remove`/`list`).
 */

type StorageCalls = { removed: string[][]; listed: string[] };

interface StubOptions {
  /** Row returned by the pre-delete `select` on `insight_cards`. */
  cardRow?: Record<string, unknown> | null;
  /** Error returned by the `insight_cards` `.delete()`. */
  deleteError?: { message: string } | null;
  /** Error returned by every `storage.remove()` call. */
  removeError?: { message: string } | null;
  /** `rpc("replace_ai_draft_cards", ...)` response. */
  rpcData?: { inserted: number; orphan_paths?: string[] } | null;
  rpcError?: { message: string } | null;
  /** Rows returned by the post-RPC `select ... is("template_id", null)` (new cards to backfill template_id for). Empty by default. */
  newCards?: Record<string, unknown>[];
  /** `storage.list()` responses keyed by the exact path argument. */
  listByPath?: Record<string, { data: Array<{ name: string; id: string | null }> | null; error?: { message: string } | null }>;
}

function makeStub(opts: StubOptions, calls: StorageCalls): SupabaseClient {
  const cardFixture = opts.cardRow ?? null;

  const insightCardsChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      not: () => chain,
      limit: () => chain,
      update: () => chain,
      maybeSingle: () => Promise.resolve({ data: cardFixture, error: null }),
      single: () => Promise.resolve({ data: cardFixture, error: null }),
      delete: () => ({
        eq: () => Promise.resolve({ error: opts.deleteError ?? null }),
      }),
      then: (resolve: (v: unknown) => unknown) =>
        resolve({ data: opts.newCards ?? [], error: null }),
    };
    return chain;
  };

  return {
    from: (table: string) => {
      if (table === "insight_cards") return insightCardsChain();
      throw new Error(`unexpected table in test stub: ${table}`);
    },
    rpc: (_name: string, _args: unknown) =>
      Promise.resolve({ data: opts.rpcData ?? null, error: opts.rpcError ?? null }),
    storage: {
      from: (_bucket: string) => ({
        remove: async (paths: string[]) => {
          calls.removed.push(paths);
          return { data: null, error: opts.removeError ?? null };
        },
        list: async (path: string, _options?: unknown) => {
          calls.listed.push(path);
          const entry = opts.listByPath?.[path];
          if (!entry) return { data: [], error: null };
          return { data: entry.data, error: entry.error ?? null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deleteAiInsightCardCore — frame cleanup (NIVEL#243)", () => {
  it("карточка с двумя кадрами → remove вызван один раз с обоими путями, строка удалена", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        cardRow: {
          frame_before_path: "se1/c1/before-abc.jpg",
          frame_after_path: "se1/c1/after-def.jpg",
        },
      },
      calls
    );

    const result = await deleteAiInsightCardCore(sb, "c1");

    expect(result).toEqual({ success: true });
    expect(calls.removed).toEqual([["se1/c1/before-abc.jpg", "se1/c1/after-def.jpg"]]);
  });

  it("карточка без кадров → remove не вызывается", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      { cardRow: { frame_before_path: null, frame_after_path: null } },
      calls
    );

    const result = await deleteAiInsightCardCore(sb, "c1");

    expect(result).toEqual({ success: true });
    expect(calls.removed).toEqual([]);
  });

  it("ошибка delete строки → ранний возврат, Storage не трогаем", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        cardRow: { frame_before_path: "se1/c1/before.jpg", frame_after_path: null },
        deleteError: { message: "db is down" },
      },
      calls
    );

    const result = await deleteAiInsightCardCore(sb, "c1");

    expect(result).toEqual({ error: "db is down" });
    expect(calls.removed).toEqual([]);
  });

  it("ошибка storage.remove не роняет удаление карточки, только логируется", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        cardRow: {
          frame_before_path: "se1/c1/before.jpg",
          frame_after_path: "se1/c1/after.jpg",
        },
        removeError: { message: "storage unavailable" },
      },
      calls
    );

    const result = await deleteAiInsightCardCore(sb, "c1");

    expect(result).toEqual({ success: true });
    expect(calls.removed).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0].join(" ")).toContain("deleteAiInsightCardCore");
  });
});

describe("deleteInsightCardCore — frame cleanup, second card-delete path (NIVEL#243)", () => {
  it("карточка с двумя кадрами → remove вызван один раз с обоими путями", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        cardRow: {
          session_id: "se1",
          frame_before_path: "se1/c2/before.jpg",
          frame_after_path: "se1/c2/after.jpg",
        },
      },
      calls
    );

    const result = await deleteInsightCardCore(sb, "c2");

    expect(result).toEqual({ success: true, sessionId: "se1" });
    expect(calls.removed).toEqual([["se1/c2/before.jpg", "se1/c2/after.jpg"]]);
  });

  it("ошибка storage.remove не роняет удаление карточки", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        cardRow: {
          session_id: "se1",
          frame_before_path: "se1/c2/before.jpg",
          frame_after_path: null,
        },
        removeError: { message: "storage unavailable" },
      },
      calls
    );

    const result = await deleteInsightCardCore(sb, "c2");

    expect(result).toEqual({ success: true, sessionId: "se1" });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("saveAiDraftCards — orphan_paths cleanup on re-analyze (S4/#239, NIVEL#243)", () => {
  it("RPC возвращает orphan_paths → один батч remove с этими путями", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        rpcData: {
          inserted: 2,
          orphan_paths: ["se1/old1/before.jpg", "se1/old1/after.jpg"],
        },
        newCards: [],
      },
      calls
    );

    const result = await saveAiDraftCards(sb, "se1", "student-1", "trainer-1", [
      { title: "T1", body: "B1", quote: "q1", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
      { title: "T2", body: "B2", quote: "q2", tag: "тактика", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(result).toEqual({ count: 2 });
    expect(calls.removed).toEqual([["se1/old1/before.jpg", "se1/old1/after.jpg"]]);
  });

  it("orphan_paths пуст → remove не вызывается", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      { rpcData: { inserted: 1, orphan_paths: [] }, newCards: [] },
      calls
    );

    await saveAiDraftCards(sb, "se1", "student-1", "trainer-1", [
      { title: "T1", body: "B1", quote: "q1", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(calls.removed).toEqual([]);
  });

  it("ошибка storage.remove на orphan-путях не мешает вернуть count", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        rpcData: { inserted: 3, orphan_paths: ["se1/old/before.jpg"] },
        removeError: { message: "storage unavailable" },
        newCards: [],
      },
      calls
    );

    const result = await saveAiDraftCards(sb, "se1", "student-1", "trainer-1", [
      { title: "T1", body: "B1", quote: "q1", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(result).toEqual({ count: 3 });
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("removeSessionFramesCore — prefix sweep for a whole session (NIVEL#243, currently unwired — see audio.ts)", () => {
  it("рекурсивно обходит папки-карточки и удаляет все файлы одним батчем", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        listByPath: {
          se1: {
            data: [
              { name: "card1", id: null }, // folder
              { name: "card2", id: null }, // folder
            ],
          },
          "se1/card1": {
            data: [{ name: "before-abc.jpg", id: "obj-1" }, { name: "after-def.jpg", id: "obj-2" }],
          },
          "se1/card2": {
            data: [{ name: "before-ghi.jpg", id: "obj-3" }],
          },
        },
      },
      calls
    );

    await removeSessionFramesCore(sb, "se1");

    expect(calls.listed.sort()).toEqual(["se1", "se1/card1", "se1/card2"].sort());
    expect(calls.removed).toHaveLength(1);
    expect(calls.removed[0].sort()).toEqual(
      [
        "se1/card1/before-abc.jpg",
        "se1/card1/after-def.jpg",
        "se1/card2/before-ghi.jpg",
      ].sort()
    );
  });

  it("пустой префикс (нет объектов) → no-op, remove не вызывается, не ошибка", async () => {
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub({ listByPath: { se1: { data: [] } } }, calls);

    await expect(removeSessionFramesCore(sb, "se1")).resolves.toBeUndefined();
    expect(calls.removed).toEqual([]);
  });

  it("ошибка list — логируется, не бросает, remove не вызывается", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      { listByPath: { se1: { data: null, error: { message: "bucket unreachable" } } } },
      calls
    );

    await expect(removeSessionFramesCore(sb, "se1")).resolves.toBeUndefined();
    expect(calls.removed).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("ошибка remove — логируется, не бросает", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls: StorageCalls = { removed: [], listed: [] };
    const sb = makeStub(
      {
        listByPath: { se1: { data: [{ name: "before.jpg", id: "obj-1" }] } },
        removeError: { message: "storage unavailable" },
      },
      calls
    );

    await expect(removeSessionFramesCore(sb, "se1")).resolves.toBeUndefined();
    expect(calls.removed).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
