import { NextResponse } from "next/server";
import {
  guardSession,
  parseJson,
  badRequest,
  notFound,
  coreError,
} from "@/lib/api/respond";
import {
  applyCollectionToStudentCore,
  collectionBelongsToTrainer,
} from "@/lib/core/insightCards";

/**
 * POST /api/v1/collections/{id}/apply
 * Body: { sessionId: string }
 *
 * Applies every card template in the collection to the session's student.
 * Trainer-only; the trainer must own both the collection and the session.
 * Mirrors the web `applyCollectionToStudent` Server Action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = await parseJson<{ sessionId?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.sessionId) return badRequest("sessionId is required");

  // Ownership of the session also establishes the authenticated trainer.
  const guard = await guardSession(parsed.body.sessionId);
  if (!guard.ok) return guard.res;

  if (!(await collectionBelongsToTrainer(guard.ctx.supabase, id, guard.ctx.trainerId))) {
    return notFound("collection not found");
  }

  const result = await applyCollectionToStudentCore(
    guard.ctx.supabase,
    guard.ctx.trainerId,
    id,
    parsed.body.sessionId
  );
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, applied: result.applied });
}
