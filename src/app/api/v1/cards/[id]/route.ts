import { NextResponse } from "next/server";
import { guardCard, parseJson, badRequest } from "@/lib/api/respond";
import {
  updateAiInsightCardCore,
  deleteAiInsightCardCore,
  validateAiInsightCardPatch,
} from "@/lib/core/aiInsights";

/**
 * PATCH /api/v1/cards/{id}
 * Body: { title, body, tag, side? }
 *
 * Edits a draft/approved insight card's content (propagates to template
 * siblings). Trainer-only; ownership of the card enforced. Mirrors the web
 * `updateAiInsightCard` Server Action.
 */
type PatchBody = { title?: string; body?: string; tag?: string; side?: string | null };

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = await parseJson<PatchBody>(request);
  if (!parsed.ok) return parsed.res;
  const { title, body, tag, side } = parsed.body;

  if (typeof title !== "string" || typeof body !== "string" || typeof tag !== "string") {
    return badRequest("title, body and tag are required");
  }

  // Validate before the ownership lookup, matching the web action's ordering.
  const patch = { title, body, tag, side: side ?? null };
  const validationError = validateAiInsightCardPatch(patch);
  if (validationError) return badRequest(validationError);

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const result = await updateAiInsightCardCore(
    guard.ctx.supabase,
    id,
    guard.ctx.templateId,
    patch
  );
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/v1/cards/{id}
 *
 * Deletes an insight card. Trainer-only; ownership enforced. Mirrors the web
 * `deleteAiInsightCard` Server Action.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const result = await deleteAiInsightCardCore(guard.ctx.supabase, id);
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json({ ok: true });
}
