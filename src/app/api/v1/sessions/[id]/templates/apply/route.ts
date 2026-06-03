import { NextResponse } from "next/server";
import { guardSession, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { applyTemplateToStudentCore } from "@/lib/core/insightCards";

/**
 * POST /api/v1/sessions/{id}/templates/apply
 * Body: { templateId: string }
 *
 * Applies a saved card template to the session's student (creates an approved
 * card). Trainer-only; ownership of the session enforced. Mirrors the web
 * `applyTemplateToStudent` Server Action.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ templateId?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.templateId) return badRequest("templateId is required");

  const result = await applyTemplateToStudentCore(
    guard.ctx.supabase,
    guard.ctx.trainerId,
    parsed.body.templateId,
    id
  );
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
