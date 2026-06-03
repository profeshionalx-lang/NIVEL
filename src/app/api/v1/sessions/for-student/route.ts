import { NextResponse } from "next/server";
import { guardStudent, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { createSessionForStudentCore } from "@/lib/core/sessions";

/**
 * POST /api/v1/sessions/for-student
 * Body: { studentId, goalId, scheduledAt?, completedAt?, trainerNotes?, status? }
 *
 * Creates a lightweight session (planned or completed) for a student without the
 * exercise builder. Trainer-only; the trainer must own the student. Mirrors the
 * web `createSessionForStudent` Server Action.
 */
type Body = {
  studentId?: string;
  goalId?: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  trainerNotes?: string | null;
  status?: "planned" | "completed";
};

export async function POST(request: Request) {
  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;
  const { studentId, goalId, scheduledAt, completedAt, trainerNotes, status } = parsed.body;

  if (!studentId || !goalId) {
    return badRequest("studentId and goalId are required");
  }
  if (status && status !== "planned" && status !== "completed") {
    return badRequest("status must be 'planned' or 'completed'");
  }

  const guard = await guardStudent(studentId);
  if (!guard.ok) return guard.res;

  const result = await createSessionForStudentCore(guard.ctx.supabase, studentId, goalId, {
    scheduledAt,
    completedAt,
    trainerNotes,
    status,
  });
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
