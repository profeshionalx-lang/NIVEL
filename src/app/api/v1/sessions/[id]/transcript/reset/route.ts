import { NextResponse } from "next/server";
import { guardSession } from "@/lib/api/respond";
import { deleteTranscriptCore } from "@/lib/core/audio";

/**
 * POST /api/v1/sessions/{id}/transcript/reset
 *
 * Clears a failed/stuck transcript so the trainer can re-upload audio and
 * retry transcription (#227). Uses the same `deleteTranscriptCore` as
 * `DELETE /transcript` — the web `resetTranscript` action does exactly this,
 * it only differs in redirecting back to the session page afterwards, which
 * doesn't apply to the native client. Trainer-only; ownership enforced.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  await deleteTranscriptCore(guard.ctx.supabase, id);

  return NextResponse.json({ ok: true });
}
