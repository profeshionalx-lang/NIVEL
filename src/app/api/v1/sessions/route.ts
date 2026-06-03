import { NextResponse } from "next/server";
import { guardStudent, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { createSessionCore } from "@/lib/core/sessions";

/**
 * POST /api/v1/sessions
 * Body: { goalId, studentId, exercises: [{ name, skillNames: [] }] }
 *
 * Creates a planned training session with exercises + skills (resolving/creating
 * them as needed) and bumps skill progress. Trainer-only; the trainer must own
 * the student. Mirrors the web `createSession` Server Action.
 */
type Body = {
  goalId?: string;
  studentId?: string;
  exercises?: { name: string; skillNames: string[] }[];
};

export async function POST(request: Request) {
  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;
  const { goalId, studentId, exercises } = parsed.body;

  if (!goalId || !studentId) {
    return badRequest("goalId and studentId are required");
  }
  if (!Array.isArray(exercises)) {
    return badRequest("exercises must be an array");
  }

  const guard = await guardStudent(studentId);
  if (!guard.ok) return guard.res;

  const result = await createSessionCore(guard.ctx.supabase, goalId, studentId, exercises);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
