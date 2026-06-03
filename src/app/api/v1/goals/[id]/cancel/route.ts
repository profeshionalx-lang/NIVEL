import { NextResponse } from "next/server";
import { guardGoal, coreError } from "@/lib/api/respond";
import { cancelGoalCore } from "@/lib/core/goals";

/**
 * POST /api/v1/goals/{id}/cancel
 *
 * Marks the goal as cancelled. Trainer-only; the trainer must own the goal's
 * student. Mirrors the web `cancelGoal` Server Action (with added ownership).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const guard = await guardGoal(id);
  if (!guard.ok) return guard.res;

  const result = await cancelGoalCore(guard.ctx.supabase, id);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true });
}
