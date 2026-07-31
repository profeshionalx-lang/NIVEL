import { NextResponse } from "next/server";
import { guardCard, badRequest } from "@/lib/api/respond";
import { deleteFrameCore } from "@/lib/core/frames";

/**
 * DELETE /api/v1/cards/{id}/frames/{slot}
 *
 * Clears a card's frame slot (`before` | `after`): deletes the Storage object
 * if present and nulls the column. Idempotent — an already-empty slot is a
 * 200, not a 404, so the native client can call this without checking state
 * first. Trainer-only; ownership of the card enforced.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; slot: string }> }
) {
  const { id, slot } = await params;

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const result = await deleteFrameCore(guard.ctx.supabase, id, slot);
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json(result);
}
