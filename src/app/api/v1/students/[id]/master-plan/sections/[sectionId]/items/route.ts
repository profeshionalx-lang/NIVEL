import { NextResponse } from "next/server";
import { guardStudent, parseJson, badRequest, notFound, coreError } from "@/lib/api/respond";
import { addMasterPlanItemCore, sectionBelongsToStudent } from "@/lib/core/masterPlan";

/**
 * POST /api/v1/students/{id}/master-plan/sections/{sectionId}/items
 * Body: { title, description?, imageUrl?, sortOrder? }
 *
 * Adds an item to a section. Trainer-only; the trainer must own the student and
 * the section must belong to that student's plan. Mirrors the web `addItem`.
 */
type Body = {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const { id, sectionId } = await params;

  const guard = await guardStudent(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<Body>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.title?.trim()) return badRequest("title is required");

  if (!(await sectionBelongsToStudent(guard.ctx.supabase, sectionId, id))) {
    return notFound("section not found for student");
  }

  const result = await addMasterPlanItemCore(guard.ctx.supabase, sectionId, {
    title: parsed.body.title,
    description: parsed.body.description,
    imageUrl: parsed.body.imageUrl,
    sortOrder: parsed.body.sortOrder,
  });
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
