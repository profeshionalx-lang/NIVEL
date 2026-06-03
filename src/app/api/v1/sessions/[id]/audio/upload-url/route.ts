import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { requestAudioUploadUrlCore } from "@/lib/core/audio";

/**
 * POST /api/v1/sessions/{id}/audio/upload-url
 * Body: { ext?: string }  (default "m4a")
 *
 * Returns a Supabase signed upload URL for the session's audio. The native
 * client PUTs the recording directly to that URL, then calls .../transcribe.
 * Trainer-only; ownership of the session is enforced.
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

  let ext = "m4a";
  try {
    const body = await request.json();
    if (body?.ext) ext = String(body.ext);
  } catch {
    // Body is optional — default ext is fine.
  }

  const result = await requestAudioUploadUrlCore(ctx.supabase, id, ext);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
