import { NextResponse } from "next/server";
import { guardSession, parseJson, coreError } from "@/lib/api/respond";
import { setTrainerReviewCompletedCore } from "@/lib/core/sessions";

/**
 * POST /api/v1/sessions/{id}/review-complete
 * Body: { completed?: boolean }  (default true)
 *
 * Marks the trainer review as complete/incomplete. On completion this fires the
 * "new insights" student push and may transition the session to completed.
 * Trainer-only; ownership of the session enforced.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  // Body is optional; default to completing the review.
  let completed = true;
  const parsed = await parseJson<{ completed?: boolean }>(request);
  if (parsed.ok && typeof parsed.body?.completed === "boolean") {
    completed = parsed.body.completed;
  }

  const result = await setTrainerReviewCompletedCore(guard.ctx.supabase, id, completed);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
