import { NextResponse } from "next/server";
import { guardCard, parseJson, badRequest } from "@/lib/api/respond";
import { attachFrameCore } from "@/lib/core/frames";

/**
 * POST /api/v1/cards/{id}/frames
 * Body: { slot: "before" | "after", storagePath: string }
 *
 * Attaches an already-uploaded Storage object (see .../frames/upload-url) to
 * a card's frame slot. Rejects a `storagePath` that wasn't issued for this
 * session+card. If the slot already has a frame, the previous object is
 * deleted from Storage first. Trainer-only; ownership of the card enforced.
 */
type Body = { slot?: unknown; storagePath?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const result = await attachFrameCore(
    guard.ctx.supabase,
    guard.ctx.sessionId,
    id,
    parsed.body.slot,
    parsed.body.storagePath
  );
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json(result);
}
