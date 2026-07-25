import { NextResponse } from "next/server";
import { guardStudent } from "@/lib/api/respond";
import { getStudentInviteCore } from "@/lib/core/students";

/**
 * GET /api/v1/students/{id}/invite
 * Trainer-only, must own the student. Returns the student's claim invite
 * status. `token: null` when the student has no invite yet (not a 404).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const invite = await getStudentInviteCore(guard.ctx.supabase, id);
  if (!invite) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    token: invite.token,
    status: invite.status,
    claimed_at: invite.claimed_at,
  });
}
