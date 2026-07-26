import { NextResponse } from "next/server";
import { guardSession } from "@/lib/api/respond";
import { requeueAiInsightsCore } from "@/lib/core/aiInsights";

/**
 * POST /api/v1/sessions/{id}/insights/requeue
 *
 * Puts a ready transcript back into the analysis queue (`analysis_status:
 * "idle"`) so the pm2 `claude`-based analyzer daemon picks it up again.
 * Mirrors the web `requeueAiInsights` Server Action (#227). Trainer-only;
 * ownership enforced.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  const result = await requeueAiInsightsCore(guard.ctx.supabase, id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
