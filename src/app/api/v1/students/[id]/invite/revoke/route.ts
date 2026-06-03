import { NextResponse } from "next/server";
import { guardStudent, coreError } from "@/lib/api/respond";
import { revokeClaimTokenCore } from "@/lib/core/students";

/**
 * POST /api/v1/students/{id}/invite/revoke
 *
 * Clears the student's claim token so the invite link stops working.
 * Trainer-only; the trainer must own the student. Mirrors the web
 * `revokeClaimToken` Server Action.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const result = await revokeClaimTokenCore(guard.ctx.supabase, id);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
