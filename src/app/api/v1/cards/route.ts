import { NextResponse } from "next/server";
import { guardTrainer } from "@/lib/api/respond";
import { getCardLibraryCore } from "@/lib/core/trainerReads";

/**
 * GET /api/v1/cards
 *
 * Trainer-only. The card template library: the trainer's insight cards
 * deduplicated by `template_id` with per-template student stats, plus the
 * student list used by the apply sheet. Mirrors the web `trainer/cards` page.
 *
 * Response: { templates: CardLibraryTemplate[], students: CardLibraryStudentRef[] }
 */
export async function GET() {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const data = await getCardLibraryCore(guard.ctx.supabase, guard.ctx.user.id);
  return NextResponse.json(data);
}
