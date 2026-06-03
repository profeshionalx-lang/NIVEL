import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireTrainer } from "@/lib/auth/ownership";
import { getReferenceCore } from "@/lib/core/trainerReads";

/**
 * GET /api/v1/reference
 * Trainer-only. Reference dictionaries (problem categories + problems, skills,
 * exercises) used to compose goals / sessions / insight cards.
 *
 * Localized via `?lang=ru|en` (falls back to the Accept-Language header, then ru).
 */
function resolveLang(request: Request): "ru" | "en" {
  const q = new URL(request.url).searchParams.get("lang")?.toLowerCase();
  if (q === "en" || q === "ru") return q;
  const header = request.headers.get("accept-language")?.toLowerCase() ?? "";
  return header.startsWith("en") ? "en" : "ru";
}

export async function GET(request: Request) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const ctx = await requireTrainer();
  if (!ctx) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const reference = await getReferenceCore(ctx.supabase, resolveLang(request));
  return NextResponse.json(reference);
}
