import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { listStudentsCore } from "@/lib/core/trainerReads";

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
