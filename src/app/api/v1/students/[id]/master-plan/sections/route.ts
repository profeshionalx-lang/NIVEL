import { NextResponse } from "next/server";
import { guardStudent, parseJson, badRequest, notFound, coreError } from "@/lib/api/respond";
import { addMasterPlanSectionCore, planBelongsToStudent } from "@/lib/core/masterPlan";
import type { MasterPlanCategory } from "@/lib/types";

const VALID_CATEGORIES: MasterPlanCategory[] = ["strength", "technique", "tactics", "custom"];

/**
 * POST /api/v1/students/{id}/master-plan/sections
 * Body: { planId, title, category, sortOrder? }
 *
 * Adds a section to the student's master plan. Trainer-only; the trainer must
 * own the student and the plan must belong to that student. Mirrors the web
 * `addSection` Server Action.
 */
type Body = {
  planId?: string;
  title?: string;
  category?: MasterPlanCategory;
  sortOrder?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;
  const { planId, title, category, sortOrder } = parsed.body;

  if (!planId) return badRequest("planId is required");
  if (!title?.trim()) return badRequest("title is required");
  if (!category || !VALID_CATEGORIES.includes(category)) {
    return badRequest("category must be one of: strength, technique, tactics, custom");
  }

  if (!(await planBelongsToStudent(guard.ctx.supabase, planId, id))) {
    return notFound("plan not found for student");
  }

  const result = await addMasterPlanSectionCore(guard.ctx.supabase, planId, {
    title,
    category,
    sortOrder,
  });
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
