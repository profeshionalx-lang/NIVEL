import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { transcribeSessionCore } from "@/lib/core/audio";

// STT (download + Groq Whisper) runs inline and can take a while for long
// recordings — allow up to the platform max.
export const maxDuration = 300;

/**
 * POST /api/v1/sessions/{id}/transcribe
 * Body: { storagePath: string }  (from the upload-url step)
 *
 * Runs the existing Groq STT pipeline: downloads the uploaded audio,
 * transcribes it, stores the transcript, and removes the audio file.
 * Trainer-only; ownership enforced.
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

  const result = await transcribeSessionCore(ctx.supabase, id, storagePath);
  if (!result.success) {
    // Transcript row is marked 'failed' by the core; surface the reason.
    return NextResponse.json({ error: result.error ?? "transcription_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
