import { NextResponse } from "next/server";
import { guardTrainer } from "@/lib/api/respond";
import { listCardTemplatesCore } from "@/lib/core/insightCards";

/**
 * GET /api/v1/card-templates?q=&limit=
 *
 * Trainer's card template library — the same dedup-by-template_id set used to
 * assemble collections on `/trainer/cards`. `q` filters by substring on
 * title/body (case-insensitive). Capped at 50 results.
 */
export async function GET(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  const templates = await listCardTemplatesCore(guard.ctx.supabase, guard.ctx.user.id, q, 50);
  return NextResponse.json({ templates });
}
