import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getStudentDetailCore,
  getSessionDetailCore,
  getSessionInsightCardsCore,
  getReferenceCore,
  getMasterPlanCore,
} from "../trainerReads";
import { getTranscriptStatusCore, requestAudioUploadUrlCore } from "../audio";

/**
 * Контракт-тесты `/api/v1` read- и audio-эндпоинтов (A6, #187).
 *
 * Цель — **падать при несовместимом изменении формы ответа**: эти шейпы напрямую
 * мапятся в DTO нативного клиента (`nivel-android/.../data/remote/Dto.kt`), и тихое
 * переименование/удаление поля в ядре сломало бы десериализацию в приложении.
 *
 * Проверяем `*Core`-функции (форму ответа задают именно они; route-хендлеры —
 * тонкая обёртка) на mock-supabase, сверяя ТОЧНЫЙ набор ключей каждого объекта.
 */

type Fixture = { rows?: Record<string, unknown>[]; count?: number };

/**
 * Минимальный mock supabase: chainable query-builder, отдающий канонед-данные по
 * имени таблицы. Любой цепочечный метод возвращает builder; терминальный `await`
 * отдаёт `{ data, count }`, а `maybeSingle`/`single` — первый ряд. `head:true`
 * (count-запросы) отдаёт `{ count }`. Покрывает запросы read/audio-ядер.
 */
function makeSupabaseStub(fixtures: Record<string, Fixture>): SupabaseClient {
  const buildFor = (table: string) => {
    let head = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {
      select: (_cols?: string, opts?: { head?: boolean; count?: string }) => {
        if (opts?.head) head = true;
        return b;
      },
      eq: () => b,
      in: () => b,
      ilike: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () =>
        Promise.resolve({ data: fixtures[table]?.rows?.[0] ?? null, error: null }),
      single: () =>
        Promise.resolve({ data: fixtures[table]?.rows?.[0] ?? null, error: null }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
        const f = fixtures[table] ?? {};
        const result = head
          ? { count: f.count ?? f.rows?.length ?? 0, error: null }
          : { data: f.rows ?? [], count: f.count ?? f.rows?.length ?? 0, error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return b;
  };

  return {
    from: (table: string) => buildFor(table),
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: {
            signedUrl: `https://stub.supabase.co/storage/v1/object/upload/sign/session-audio/${path}?token=tok`,
            path,
            token: "tok",
          },
          error: null,
        }),
      }),
    },
  } as unknown as SupabaseClient;
}

/** Точный набор ключей объекта — ловит и удаление, и добавление поля. */
function expectKeys(obj: unknown, keys: string[]) {
  expect(obj && typeof obj === "object").toBe(true);
  expect(Object.keys(obj as Record<string, unknown>).sort()).toEqual([...keys].sort());
}

describe("GET /api/v1/reference — getReferenceCore", () => {
  it("шейп справочников стабилен", async () => {
    const sb = makeSupabaseStub({
      problem_categories: { rows: [{ id: 1, sort_order: 0, name_ru: "Техника" }] },
      problems: { rows: [{ id: 2, category_id: 1, sort_order: 0, name_ru: "Приём" }] },
      skills: { rows: [{ id: 3, name_ru: "Бэкхенд" }] },
      exercises: { rows: [{ id: 4, name: "Стенка" }] },
    });
    const r = await getReferenceCore(sb, "ru");
    expectKeys(r, ["problem_categories", "problems", "skills", "exercises"]);
    expect(r.problem_categories[0]).toEqual({ id: 1, name: "Техника", sort_order: 0 });
    expectKeys(r.problems[0], ["id", "category_id", "name", "sort_order"]);
    expectKeys(r.skills[0], ["id", "name"]);
    expectKeys(r.exercises[0], ["id", "name"]);
  });
});

describe("GET /api/v1/students/{id} — getStudentDetailCore", () => {
  it("шейп профиля/целей/сессий стабилен", async () => {
    const sb = makeSupabaseStub({
      profiles: {
        rows: [{ id: "s1", email: "a@b.c", full_name: "Иван", avatar_url: null, role: "student" }],
      },
      goals: { rows: [{ id: "g1", custom_problem: "X", status: "active", created_at: "2026-01-01" }] },
      sessions: {
        rows: [{
          id: "se1", goal_id: "g1", session_number: 1, status: "planned",
          scheduled_at: null, completed_at: null, created_at: "2026-01-02",
        }],
      },
    });
    const r = await getStudentDetailCore(sb, "s1");
    expectKeys(r, ["id", "email", "full_name", "avatar_url", "goals", "sessions"]);
    expectKeys(r!.goals[0], ["id", "custom_problem", "status", "created_at"]);
    expectKeys(r!.sessions[0], [
      "id", "goal_id", "session_number", "status", "scheduled_at", "completed_at", "created_at",
    ]);
  });

  it("не-student → null (контракт 404)", async () => {
    const sb = makeSupabaseStub({
      profiles: { rows: [{ id: "t1", email: null, full_name: null, avatar_url: null, role: "trainer" }] },
    });
    expect(await getStudentDetailCore(sb, "t1")).toBeNull();
  });
});

describe("GET /api/v1/sessions/{id} — getSessionDetailCore", () => {
  it("шейп деталей сессии стабилен (без created_at, с exercises)", async () => {
    const sb = makeSupabaseStub({
      sessions: {
        rows: [{
          id: "se1", goal_id: "g1", session_number: 1, status: "planned",
          trainer_notes: null, scheduled_at: null, completed_at: null,
        }],
      },
      session_exercises: { rows: [{ id: 10, sort_order: 1, exercises: { name: "Стенка" } }] },
    });
    const r = await getSessionDetailCore(sb, "se1");
    expectKeys(r, [
      "id", "goal_id", "session_number", "status", "trainer_notes",
      "scheduled_at", "completed_at", "exercises",
    ]);
    expectKeys(r!.exercises[0], ["id", "name", "sort_order"]);
    expect(r!.exercises[0]).toEqual({ id: 10, name: "Стенка", sort_order: 1 });
  });

  it("нет сессии → null (контракт 404)", async () => {
    expect(await getSessionDetailCore(makeSupabaseStub({}), "missing")).toBeNull();
  });
});

describe("GET /api/v1/sessions/{id}/insight-cards — getSessionInsightCardsCore", () => {
  it("шейп карточки стабилен (без session_id/student_id/trainer_id)", async () => {
    const sb = makeSupabaseStub({
      insight_cards: {
        rows: [{
          id: "c1", title: "T", body: "B", quote: null, tags: ["x"],
          front_text: null, context_text: null, source: null,
          trainer_status: "draft", student_decision: null, position: 0, created_at: "2026-01-01",
        }],
      },
    });
    const cards = await getSessionInsightCardsCore(sb, "se1");
    expect(Array.isArray(cards)).toBe(true);
    expectKeys(cards[0], [
      "id", "title", "body", "quote", "tags", "front_text", "context_text",
      "source", "trainer_status", "student_decision", "position", "created_at",
    ]);
  });
});

describe("GET /api/v1/students/{id}/master-plan — getMasterPlanCore", () => {
  it("шейп плана/секций/пунктов стабилен", async () => {
    const sb = makeSupabaseStub({
      master_plans: {
        rows: [{ id: "p1", student_id: "s1", trainer_id: "t1", created_at: "a", updated_at: "b" }],
      },
      master_plan_sections: {
        rows: [{
          id: "sec1", plan_id: "p1", title: "T", category: "technique", sort_order: 0,
          master_plan_items: [{
            id: "i1", section_id: "sec1", title: "It", description: null, image_url: null, sort_order: 0,
          }],
        }],
      },
    });
    const r = await getMasterPlanCore(sb, "s1");
    expectKeys(r, ["id", "student_id", "trainer_id", "created_at", "updated_at", "sections"]);
    expectKeys(r!.sections[0], ["id", "plan_id", "title", "category", "sort_order", "items"]);
    expectKeys(r!.sections[0].items[0], [
      "id", "section_id", "title", "description", "image_url", "sort_order",
    ]);
  });

  it("нет плана → null", async () => {
    expect(await getMasterPlanCore(makeSupabaseStub({}), "s1")).toBeNull();
  });
});

describe("GET /api/v1/sessions/{id}/transcript/status — getTranscriptStatusCore", () => {
  it("шейп статуса стабилен; дефолт analysis_status=idle", async () => {
    const sb = makeSupabaseStub({
      transcripts: {
        rows: [{ status: "processing", error_message: null, analysis_status: undefined, analysis_error: null }],
      },
    });
    const r = await getTranscriptStatusCore(sb, "se1");
    expectKeys(r, ["status", "error_message", "analysis_status", "analysis_error"]);
    expect(r!.analysis_status).toBe("idle"); // дефолт при отсутствии значения
  });

  it("нет строки транскрипта → null (контракт 404)", async () => {
    expect(await getTranscriptStatusCore(makeSupabaseStub({}), "se1")).toBeNull();
  });
});

describe("POST /api/v1/sessions/{id}/audio/upload-url — requestAudioUploadUrlCore", () => {
  it("шейп ответа стабилен; storagePath = <sessionId>/<uuid>.<ext>", async () => {
    const r = await requestAudioUploadUrlCore(makeSupabaseStub({}), "sess-1", "m4a");
    expectKeys(r, ["uploadUrl", "storagePath"]);
    expect((r as { storagePath: string }).storagePath).toMatch(/^sess-1\/.+\.m4a$/);
    expect((r as { uploadUrl: string }).uploadUrl).toContain("/object/upload/sign/");
  });

  it("неизвестное расширение нормализуется в m4a", async () => {
    const r = await requestAudioUploadUrlCore(makeSupabaseStub({}), "sess-1", "exe");
    expect((r as { storagePath: string }).storagePath).toMatch(/\.m4a$/);
  });
});
