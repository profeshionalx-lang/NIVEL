import { NextResponse } from "next/server";
import { guardCard, badRequest } from "@/lib/api/respond";
import { setAiCardTrainerStatusCore } from "@/lib/core/aiInsights";

/**
 * POST /api/v1/cards/{id}/reject
 *
 * Rejects a draft insight card (propagates to template siblings). Trainer-only;
 * ownership of the card enforced. Mirrors the web `rejectInsightCard`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardCard(id);
  if (!guard.ok) return guard.res;

  const result = await setAiCardTrainerStatusCore(
    guard.ctx.supabase,
    id,
    guard.ctx.templateId,
    "rejected"
  );
  if ("error" in result) return badRequest(result.error);

  return NextResponse.json({ ok: true });
}
