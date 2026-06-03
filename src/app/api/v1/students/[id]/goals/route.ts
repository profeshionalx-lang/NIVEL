import { NextResponse } from "next/server";
import { guardStudent, parseJson, coreError } from "@/lib/api/respond";
import { createGoalForStudentCore } from "@/lib/core/goals";

/**
 * POST /api/v1/students/{id}/goals
 * Body: { problemId?: number | null, customProblem?: string | null }
 *
 * Creates a training goal for the student. Trainer-only; the trainer must own
 * the student. Mirrors the web `createGoalForStudent` Server Action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ problemId?: number | null; customProblem?: string | null }>(
    request
  );
  if (!parsed.ok) return parsed.res;

  const result = await createGoalForStudentCore(
    guard.ctx.supabase,
    id,
    parsed.body?.problemId ?? null,
    parsed.body?.customProblem ?? null
  );
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, goalId: result.goalId }, { status: 201 });
}
