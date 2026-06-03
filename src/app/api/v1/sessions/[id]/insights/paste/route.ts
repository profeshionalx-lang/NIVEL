import { NextResponse } from "next/server";
import { guardSession, parseJson, badRequest } from "@/lib/api/respond";
import { pasteInsightsFromClaudeCore } from "@/lib/core/aiInsights";

/**
 * POST /api/v1/sessions/{id}/insights/paste
 * Body: { markdown: string }
 *
 * Parses pasted Claude markdown into draft insight cards. Trainer-only;
 * ownership of the session enforced. Mirrors the web `pasteInsightsFromClaude`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardSession(id);
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ markdown?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (typeof parsed.body?.markdown !== "string") {
    return badRequest("markdown is required");
  }

  const result = await pasteInsightsFromClaudeCore(
    guard.ctx.supabase,
    id,
    guard.ctx.studentId,
    guard.ctx.trainerId,
    parsed.body.markdown
  );

  if ("error" in result) {
    // Parse errors carry a line number; surface it as a 400 validation error.
    return NextResponse.json({ error: result.error, line: result.line }, { status: 400 });
  }

  return NextResponse.json({ ok: true, count: result.count });
}
