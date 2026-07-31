import { NextResponse } from "next/server";
import { guardCard, parseJson, badRequest } from "@/lib/api/respond";
import { requestFrameUploadUrlCore } from "@/lib/core/frames";

/**
 * POST /api/v1/cards/{id}/frames/upload-url
 * Body: { slot: "before" | "after", ext?: "jpg" }
 *
 * Returns a Supabase signed upload URL for a card's frame. The native client
 * PUTs the JPEG directly to that URL, then calls POST .../frames to attach
 * it to the slot. Trainer-only; ownership of the card is enforced.
 */
type Body = { slot?: unknown; ext?: unknown };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const ext = typeof parsed.body.ext === "string" ? parsed.body.ext : "jpg";
  const result = await requestFrameUploadUrlCore(
    guard.ctx.supabase,
    guard.ctx.sessionId,
    id,
    parsed.body.slot,
    ext
  );
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json(result);
}
