import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { listStudentsCore } from "@/lib/core/trainerReads";
import { guardTrainer, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { createShadowStudentCore } from "@/lib/core/students";

/**
 * GET /api/v1/students
 * Trainer-only. List of students with active-goal and total-session counts.
 */
export async function GET() {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ctx = await requireTrainer();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const students = await listStudentsCore(ctx.supabase);
  return NextResponse.json({ students });
}

/**
 * POST /api/v1/students
 * Body: { full_name: string }
 *
 * Creates a shadow student profile (no email yet) plus a claim invitation link.
 * Trainer-only. Mirrors the web `createShadowStudent` Server Action.
 */
export async function POST(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ full_name?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.full_name?.trim()) return badRequest("full_name is required");

  const result = await createShadowStudentCore(
    guard.ctx.supabase,
    guard.ctx.user.id,
    parsed.body.full_name
  );
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, ...result.result }, { status: 201 });
}
