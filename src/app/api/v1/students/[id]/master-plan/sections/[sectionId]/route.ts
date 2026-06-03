import { NextResponse } from "next/server";
import { guardStudent, notFound, coreError } from "@/lib/api/respond";
import { deleteMasterPlanSectionCore, sectionBelongsToStudent } from "@/lib/core/masterPlan";

/**
 * DELETE /api/v1/students/{id}/master-plan/sections/{sectionId}
 *
 * Deletes a section (and its items via cascade). Trainer-only; the trainer must
 * own the student and the section must belong to that student's plan. Mirrors
 * the web `deleteSection` Server Action.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { id, sectionId } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  if (!(await sectionBelongsToStudent(guard.ctx.supabase, sectionId, id))) {
    return notFound("section not found for student");
  }

  const result = await deleteMasterPlanSectionCore(guard.ctx.supabase, sectionId);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
