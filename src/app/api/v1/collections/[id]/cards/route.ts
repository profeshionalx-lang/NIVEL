import { NextResponse } from "next/server";
import { guardTrainer, guardCollection, parseJson, badRequest, notFound, coreError } from "@/lib/api/respond";
import {
  addCardToCollectionCore,
  collectionBelongsToTrainer,
  getCollectionCardsCore,
} from "@/lib/core/insightCards";

/**
 * GET /api/v1/collections/{id}/cards
 *
 * Cards in the collection, in position order. Trainer-only; the collection
 * must belong to the trainer (403 otherwise). Field shape matches
 * `GET /api/v1/sessions/{id}/insight-cards`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardCollection(id);
  if (!guard.ok) return guard.res;

  const cards = await getCollectionCardsCore(guard.ctx.supabase, id);
  return NextResponse.json({ cards });
}

/**
 * POST /api/v1/collections/{id}/cards
 * Body: { templateId: string }
 *
 * Adds a card template to the collection. Trainer-only; the collection must
 * belong to the trainer. Mirrors the web `addCardToCollection` Server Action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ templateId?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.templateId) return badRequest("templateId is required");

  if (!(await collectionBelongsToTrainer(guard.ctx.supabase, id, guard.ctx.user.id))) {
    return notFound("collection not found");
  }

  const result = await addCardToCollectionCore(guard.ctx.supabase, id, parsed.body.templateId);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
