import { NextResponse } from "next/server";
import { guardTrainer } from "@/lib/api/respond";
import { searchCardTemplatesCore } from "@/lib/core/insightCards";

/**
 * GET /api/v1/card-templates?q=
 *
 * Trainer-only. The trainer's card-template library — what `/trainer/cards`
 * collections are built from. `q` (optional) filters by title; empty → first
 * 50 alphabetically. NIVEL#226.
 * Response: { templates: [{ id, template_id, title, body, ... }] }
 */
export async function GET(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  const templates = await searchCardTemplatesCore(guard.ctx.supabase, guard.ctx.user.id, q);
  return NextResponse.json({ templates });
}
