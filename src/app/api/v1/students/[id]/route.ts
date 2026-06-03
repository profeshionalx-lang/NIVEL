import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { getStudentDetailCore } from "@/lib/core/trainerReads";
import { guardStudent, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { updateStudentProfileCore } from "@/lib/core/students";

/**
 * GET /api/v1/students/{id}
 * Trainer-only. Student profile with their goals and sessions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ctx = await requireTrainer();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const student = await getStudentDetailCore(ctx.supabase, id);
  if (!student) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(student);
}

/**
 * PATCH /api/v1/students/{id}
 * Body: { full_name?: string | null, avatar_url?: string | null }
 *
 * Updates a student's profile fields. Trainer-only; the trainer must own the
 * student. Mirrors the web `updateStudentProfile` Server Action.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ full_name?: string | null; avatar_url?: string | null }>(
    request
  );
  if (!parsed.ok) return parsed.res;

  const patch: { full_name?: string | null; avatar_url?: string | null } = {};
  if ("full_name" in parsed.body) patch.full_name = parsed.body.full_name;
  if ("avatar_url" in parsed.body) patch.avatar_url = parsed.body.avatar_url;

  if (Object.keys(patch).length === 0) {
    return badRequest("Nothing to update");
  }

  const result = await updateStudentProfileCore(guard.ctx.supabase, id, patch);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
