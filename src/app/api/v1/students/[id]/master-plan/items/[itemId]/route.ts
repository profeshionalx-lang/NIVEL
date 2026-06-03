import { NextResponse } from "next/server";
import { guardStudent, notFound, coreError } from "@/lib/api/respond";
import { deleteMasterPlanItemCore, itemBelongsToStudent } from "@/lib/core/masterPlan";

/**
 * DELETE /api/v1/students/{id}/master-plan/items/{itemId}
 *
 * Deletes a master-plan item. Trainer-only; the trainer must own the student
 * and the item must belong to that student's plan. Mirrors the web `deleteItem`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const { id, itemId } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  if (!(await itemBelongsToStudent(guard.ctx.supabase, itemId, id))) {
    return notFound("item not found for student");
  }

  const result = await deleteMasterPlanItemCore(guard.ctx.supabase, itemId);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
