import { NextResponse } from "next/server";
import { guardTrainer, notFound, coreError } from "@/lib/api/respond";
import {
  removeCardFromCollectionCore,
  collectionBelongsToTrainer,
} from "@/lib/core/insightCards";

/**
 * DELETE /api/v1/collections/{id}/cards/{templateId}
 *
 * Removes a card template from the collection. Trainer-only; the collection must
 * belong to the trainer. Mirrors the web `removeCardFromCollection`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; templateId: string }> }
) {
  const { id, templateId } = await params;

  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  if (!(await collectionBelongsToTrainer(guard.ctx.supabase, id, guard.ctx.user.id))) {
    return notFound("collection not found");
  }

  const result = await removeCardFromCollectionCore(guard.ctx.supabase, id, templateId);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
