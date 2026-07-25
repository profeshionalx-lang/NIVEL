import { NextResponse } from "next/server";
import { guardTrainer } from "@/lib/api/respond";
import { getTrainerOverviewCore } from "@/lib/core/trainerReads";

/**
 * GET /api/v1/trainer/overview
 * Trainer-only aggregate for the Android home dashboard (A6 #224):
 * student count, upcoming sessions, and sessions pending trainer review.
 */
export async function GET() {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const overview = await getTrainerOverviewCore(guard.ctx.supabase);
  return NextResponse.json(overview);
}
