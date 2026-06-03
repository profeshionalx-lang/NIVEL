import { NextResponse } from "next/server";
import { guardSession } from "@/lib/api/respond";
import { generateAiInsightsCore } from "@/lib/core/aiInsights";

// LLM analysis of the transcript runs inline and can take a while.
export const maxDuration = 300;

/**
 * POST /api/v1/sessions/{id}/insights/generate
 *
 * Runs the OpenRouter LLM over the session's ready transcript and creates draft
 * insight cards. Trainer-only; ownership of the session enforced. Mirrors the
 * web `generateAiInsights` Server Action.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  const result = await generateAiInsightsCore(
    guard.ctx.supabase,
    id,
    guard.ctx.studentId,
    guard.ctx.trainerId
  );

  if ("error" in result) {
    // Precondition errors (no ready transcript / already running) → 400.
    // Errors during analysis (LLM/parse) mark the transcript failed → 502.
    return NextResponse.json({ error: result.error }, { status: result.mutated ? 502 : 400 });
  }

  return NextResponse.json({ ok: true, count: result.count });
}
