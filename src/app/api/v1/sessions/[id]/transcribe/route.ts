import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { enqueueTranscriptionCore } from "@/lib/core/audio";

/**
 * POST /api/v1/sessions/{id}/transcribe
 * Body: { storagePath: string }  (from the upload-url step)
 *
 * Enqueues the audio for STT: marks the transcript row 'pending' and
 * returns immediately (202). The actual Groq Whisper transcription runs in
 * the background (scripts/transcribe-pending.mjs — same pm2-poller pattern
 * already used for LLM insight analysis), so this request never blocks on
 * Groq latency. Poll GET /api/v1/sessions/{id}/transcript/status for
 * progress. Trainer-only; ownership enforced.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ctx = await requireTrainerOwnsSession(id);
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let storagePath: string | undefined;
  try {
    ({ storagePath } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!storagePath) {
    return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });
  }

  const result = await enqueueTranscriptionCore(ctx.supabase, id, storagePath);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "enqueue_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, status: "pending" }, { status: 202 });
}
