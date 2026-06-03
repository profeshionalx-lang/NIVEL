import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { getTranscriptStatusCore } from "@/lib/core/audio";

/**
 * GET /api/v1/sessions/{id}/transcript/status
 *
 * Returns { status, error_message, analysis_status, analysis_error } so the
 * native client can poll the transcription → analysis progress.
 * Trainer-only; ownership enforced. 404 if no transcript row yet.
 */
export async function GET(
  _request: Request,
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

  const status = await getTranscriptStatusCore(ctx.supabase, id);
  if (!status) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(status);
}
