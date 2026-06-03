import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { getStudentDetailCore } from "@/lib/core/trainerReads";

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
