import { NextResponse } from "next/server";
import { guardStudent, notFound, badRequest } from "@/lib/api/respond";
import { regenerateClaimTokenCore } from "@/lib/core/students";

/**
 * POST /api/v1/students/{id}/invite/regenerate
 *
 * Issues a fresh claim token + invite link for an unclaimed shadow student.
 * Trainer-only; the trainer must own the student. Mirrors the web
 * `regenerateClaimToken` Server Action.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const result = await regenerateClaimTokenCore(guard.ctx.supabase, id);
  if (!result.success) {
    if (result.error === "not_found") return notFound();
    return badRequest(result.error);
  }

  return NextResponse.json({ ok: true, ...result.result });
}
