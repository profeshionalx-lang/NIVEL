import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAiInsightCardCore, saveAiDraftCards } from "../aiInsights";
import { deleteTranscriptCore } from "../audio";

/**
 * S8 (NIVEL#243): closes the three leak paths for objects in the private
 * `session-frames` bucket, since there is no DB→Storage cascade in Supabase
 * — deleting a row never deletes the object it points at.
 *
 *   1. deleteAiInsightCardCore  — delete a single card's two frame slots.
 *   2. deleteTranscriptCore     — prefix sweep of `${sessionId}/` (the closest
 *      thing this codebase has to "delete a session": reset/delete transcript).
 *   3. saveAiDraftCards         — orphan_paths returned by the
 *      `replace_ai_draft_cards` v2 RPC (S4/#239) on draft reanalysis.
 *
 * All three must be best-effort: a Storage failure is logged and swallowed,
 * never allowed to fail the row mutation that triggered the cleanup.
 */

/** Minimal chainable query-builder stub, one fixed row per table (by name). */
function makeTableStub(rows: Record<string, Record<string, unknown> | null>, deletedTables: string[]) {
  return (table: string) => {
    const row = rows[table] ?? null;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      not: () => chain,
      limit: () => chain,
      update: () => chain,
      delete: () => {
        deletedTables.push(table);
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
      single: () => Promise.resolve({ data: row, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: row ? [row] : [], error: null }),
    };
    return chain;
  };
}

/**
 * Storage stub shared by all three tests. `list()` is keyed by `${bucket}:${prefix}`
 * so the recursive prefix-sweep in `deleteSessionFramesCore` (called from
 * `deleteTranscriptCore`) can be driven level by level, mirroring the real
 * `${sessionId}/${cardId}/${slot}-uuid.jpg` layout.
 */
function makeStorageStub(opts: {
  removedPaths: string[];
  listFixtures?: Record<string, { name: string; id: string | null }[]>;
  removeError?: string;
  listError?: string;
}) {
  return {
    from: (bucket: string) => ({
      remove: async (paths: string[]) => {
        opts.removedPaths.push(...paths);
        if (opts.removeError) return { data: null, error: { message: opts.removeError } };
        return { data: null, error: null };
      },
      list: async (prefix: string) => {
        if (opts.listError) return { data: null, error: { message: opts.listError } };
        return { data: opts.listFixtures?.[`${bucket}:${prefix}`] ?? [], error: null };
      },
    }),
  };
}

describe("deleteAiInsightCardCore — Storage cleanup on card delete (#243)", () => {
  it("удаляет карточку с двумя кадрами → строка удалена и оба объекта убраны одним batched remove()", async () => {
    const removedPaths: string[] = [];
    const deletedTables: string[] = [];
    const supabase = {
      from: makeTableStub(
        { insight_cards: { frame_before_path: "se1/c1/before-x.jpg", frame_after_path: "se1/c1/after-x.jpg" } },
        deletedTables
      ),
      storage: makeStorageStub({ removedPaths }),
    } as unknown as SupabaseClient;

    const result = await deleteAiInsightCardCore(supabase, "c1");

    expect(result).toEqual({ success: true });
    expect(deletedTables).toContain("insight_cards");
    // Один вызов remove с обоими путями — не по одному.
    expect(removedPaths).toEqual(["se1/c1/before-x.jpg", "se1/c1/after-x.jpg"]);
  });

  it("карточка без кадров → Storage не трогаем (идемпотентность)", async () => {
    const removedPaths: string[] = [];
    const supabase = {
      from: makeTableStub({ insight_cards: { frame_before_path: null, frame_after_path: null } }, []),
      storage: makeStorageStub({ removedPaths }),
    } as unknown as SupabaseClient;

    const result = await deleteAiInsightCardCore(supabase, "c1");
    expect(result).toEqual({ success: true });
    expect(removedPaths).toEqual([]);
  });

  it("Storage упал при удалении кадров → карточка всё равно успешно удалена", async () => {
    const removedPaths: string[] = [];
    const deletedTables: string[] = [];
    const supabase = {
      from: makeTableStub(
        { insight_cards: { frame_before_path: "se1/c1/before-x.jpg", frame_after_path: null } },
        deletedTables
      ),
      storage: makeStorageStub({ removedPaths, removeError: "Storage unavailable" }),
    } as unknown as SupabaseClient;

    const result = await deleteAiInsightCardCore(supabase, "c1");
    expect(result).toEqual({ success: true });
    expect(deletedTables).toContain("insight_cards");
  });
});

describe("deleteTranscriptCore — session-frames prefix cleanup on session/transcript delete (#243)", () => {
  it("удаляет транскрипт сессии с кадрами → в бакете не осталось объектов с префиксом ${sessionId}/", async () => {
    const removedPaths: string[] = [];
    const deletedTables: string[] = [];
    const supabase = {
      from: makeTableStub({ transcripts: { storage_path: null } }, deletedTables),
      storage: makeStorageStub({
        removedPaths,
        listFixtures: {
          "session-frames:se1": [{ name: "c1", id: null }], // virtual folder = card id
          "session-frames:se1/c1": [
            { name: "before-uuid.jpg", id: "obj1" },
            { name: "after-uuid.jpg", id: "obj2" },
          ],
        },
      }),
    } as unknown as SupabaseClient;

    await deleteTranscriptCore(supabase, "se1");

    expect(removedPaths).toEqual(["se1/c1/before-uuid.jpg", "se1/c1/after-uuid.jpg"]);
    expect(deletedTables).toContain("transcripts");
  });

  it("нет кадров под префиксом сессии → remove для session-frames не вызывается (идемпотентность)", async () => {
    const removedPaths: string[] = [];
    const supabase = {
      from: makeTableStub({ transcripts: { storage_path: null } }, []),
      storage: makeStorageStub({ removedPaths }),
    } as unknown as SupabaseClient;

    await deleteTranscriptCore(supabase, "se1");
    expect(removedPaths).toEqual([]);
  });

  it("Storage.list упал при уборке кадров сессии → транскрипт всё равно удалён", async () => {
    const removedPaths: string[] = [];
    const deletedTables: string[] = [];
    const supabase = {
      from: makeTableStub({ transcripts: { storage_path: null } }, deletedTables),
      storage: makeStorageStub({ removedPaths, listError: "Storage list failed" }),
    } as unknown as SupabaseClient;

    await expect(deleteTranscriptCore(supabase, "se1")).resolves.toBeUndefined();
    expect(deletedTables).toContain("transcripts");
  });
});

describe("saveAiDraftCards — orphan frame cleanup on draft reanalysis (S4/#243 end-to-end)", () => {
  it("RPC возвращает orphan_paths → объекты старых драфтов удаляются одним batched remove()", async () => {
    const removedPaths: string[] = [];
    const supabase = {
      rpc: async () => ({
        data: { inserted: 1, orphan_paths: ["se1/old1/before-a.jpg", "se1/old1/after-a.jpg"] },
        error: null,
      }),
      from: makeTableStub({ insight_cards: null }, []),
      storage: makeStorageStub({ removedPaths }),
    } as unknown as SupabaseClient;

    const result = await saveAiDraftCards(supabase, "se1", "student-1", "trainer-1", [
      { title: "T", body: "B", quote: "Q", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(result).toEqual({ count: 1 });
    expect(removedPaths).toEqual(["se1/old1/before-a.jpg", "se1/old1/after-a.jpg"]);
  });

  it("orphan_paths отсутствует/пуст → remove для session-frames не вызывается", async () => {
    const removedPaths: string[] = [];
    const supabase = {
      rpc: async () => ({ data: { inserted: 1, orphan_paths: [] }, error: null }),
      from: makeTableStub({ insight_cards: null }, []),
      storage: makeStorageStub({ removedPaths }),
    } as unknown as SupabaseClient;

    await saveAiDraftCards(supabase, "se1", "student-1", "trainer-1", [
      { title: "T", body: "B", quote: "Q", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(removedPaths).toEqual([]);
  });

  it("Storage упал при удалении orphan-путей → drafts всё равно сохранены успешно", async () => {
    const removedPaths: string[] = [];
    const supabase = {
      rpc: async () => ({ data: { inserted: 1, orphan_paths: ["se1/old1/before-a.jpg"] }, error: null }),
      from: makeTableStub({ insight_cards: null }, []),
      storage: makeStorageStub({ removedPaths, removeError: "Storage down" }),
    } as unknown as SupabaseClient;

    const result = await saveAiDraftCards(supabase, "se1", "student-1", "trainer-1", [
      { title: "T", body: "B", quote: "Q", tag: "техника", momentBeforeSeconds: null, momentAfterSeconds: null },
    ]);

    expect(result).toEqual({ count: 1 });
  });
});
