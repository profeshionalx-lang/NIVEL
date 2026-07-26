import { NextResponse } from "next/server";
import { guardTrainer, parseJson, badRequest, coreError } from "@/lib/api/respond";
import { createCollectionCore, listCollectionsCore } from "@/lib/core/insightCards";

/**
 * GET /api/v1/collections
 *
 * Card collections owned by the trainer, with `cards_count` per collection.
 * Trainer-only. Mirrors what `/trainer/cards` shows.
 */
export async function GET() {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const collections = await listCollectionsCore(guard.ctx.supabase, guard.ctx.user.id);
  return NextResponse.json({ collections });
}

/**
 * POST /api/v1/collections
 * Body: { name: string }
 *
 * Creates a card collection owned by the trainer. Trainer-only. Mirrors the web
 * `createCollection` Server Action.
 */
export async function POST(request: Request) {
  const guard = await guardTrainer();
  if (!guard.ok) return guard.res;

  const parsed = await parseJson<{ name?: string }>(request);
  if (!parsed.ok) return parsed.res;
  if (!parsed.body?.name?.trim()) return badRequest("name is required");

  const result = await createCollectionCore(guard.ctx.supabase, guard.ctx.user.id, parsed.body.name);
  if (!result.success) return coreError(result.error);

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
