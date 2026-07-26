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

  // `limit` — необязательный, всегда зажат в 1..50: клиент не может расширить окно.
  const rawLimit = Number(searchParams.get("limit"));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 50) : 50;

  const templates = await listCardTemplatesCore(guard.ctx.supabase, guard.ctx.user.id, q, limit);
  return NextResponse.json({ templates });
}
