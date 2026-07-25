import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { getTranscriptCore } from "@/lib/core/audio";

/**
 * GET /api/v1/sessions/{id}/transcript
 *
 * Returns { status, error_message, raw_text, segments_json, duration_seconds }
 * for the native client's transcript screen. Trainer-only; ownership enforced.
 * 404 if no transcript row yet. `raw_text` is null unless status === "ready".
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

  const transcript = await getTranscriptCore(ctx.supabase, id);
  if (!transcript) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(transcript);
}
