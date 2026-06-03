import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { getMasterPlanCore } from "@/lib/core/trainerReads";

/**
 * GET /api/v1/students/{id}/master-plan
 * Trainer-only. The student's master plan with sections and items.
 * Returns `{ plan: null }` (200) when the student has no plan yet.
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
  const plan = await getMasterPlanCore(ctx.supabase, id);
  return NextResponse.json({ plan });
}
