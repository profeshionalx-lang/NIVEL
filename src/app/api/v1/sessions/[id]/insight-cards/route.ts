import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import { getSessionInsightCardsCore } from "@/lib/core/trainerReads";

/**
 * GET /api/v1/sessions/{id}/insight-cards
 * Trainer-only; ownership enforced. Insight cards of the session, ordered by position.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ctx = await requireTrainerOwnsSession(id);
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const cards = await getSessionInsightCardsCore(ctx.supabase, id);
  return NextResponse.json({ cards });
}
