import { NextResponse } from "next/server";
import { guardSession, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { reorderInsightCardsCore } from "@/lib/core/insightCards";

/**
 * POST /api/v1/sessions/{id}/cards/reorder
 * Body: { orderedIds: string[] }
 *
 * Reorders the session's insight cards to match `orderedIds`. Trainer-only;
 * ownership of the session enforced. Mirrors the web `reorderInsightCards`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ orderedIds?: string[] }>(request);
  if (!parsed.ok) return parsed.res;
  if (!Array.isArray(parsed.body?.orderedIds)) {
    return badRequest("orderedIds must be an array");
  }

  const result = await reorderInsightCardsCore(guard.ctx.supabase, id, parsed.body.orderedIds);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
