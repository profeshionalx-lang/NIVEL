import { NextResponse } from "next/server";
import { guardTrainer, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { searchExercisesCore, createExerciseCore } from "@/lib/core/library";

/**
 * GET /api/v1/exercises?q=
 * Trainer-only. `q` empty → first 50 alphabetically; set → matches name_ru OR
 * name_en. See `src/lib/core/library.ts` for the search implementation.
 *
 * POST /api/v1/exercises
 * Body: { nameRu: string, nameEn?: string }. Duplicate name → returns the
 * existing row's id (200-equivalent success shape, not an error).
 */
export async function GET(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const result = await searchExercisesCore(guard.ctx.supabase, q);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({
    exercises: result.items.map(({ id, name_ru, name_en }) => ({ id, name_ru, name_en })),
  });
}

export async function POST(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ nameRu?: string; nameEn?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.nameRu?.trim()) return badRequest("nameRu is required");

  const result = await createExerciseCore(guard.ctx.supabase, parsed.body.nameRu, parsed.body.nameEn ?? "");
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
