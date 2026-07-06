import { createAuthCode } from "@/lib/telegram/authCodes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Starts the "Login via Telegram" flow: creates a one-time auth code and
 * returns a t.me deep-link with `login_<code>` as the /start payload. The
 * client opens the link, then polls GET /api/auth/telegram/status?code=...
 * until the webhook confirms it (see src/app/api/telegram/webhook/route.ts).
 *
 * Accepts an optional JSON body `{ claimToken }` (invite flow): the code is
 * then bound to the trainer-created shadow profile, and pressing Start in
 * the bot claims that profile instead of auto-creating a new one.
 */
export async function POST(request: Request): Promise<Response> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!botUsername) {
    console.error("[tg] TELEGRAM_BOT_USERNAME is not set");
    return Response.json({ error: "misconfigured" }, { status: 500 });
  }

  let claimToken: string | null = null;
  try {
    const body = (await request.json()) as { claimToken?: unknown };
    if (typeof body.claimToken === "string" && body.claimToken.trim()) {
      claimToken = body.claimToken.trim();
    }
  } catch {
    // No/invalid body — plain login without an invite.
  }

  let claimProfileId: string | undefined;
  if (claimToken) {
    const supabase = await createClient();
    const { data: shadow } = await supabase
      .from("profiles")
      .select("id, claimed_at, claim_expires_at")
      .eq("claim_token", claimToken)
      .maybeSingle();

    if (!shadow) {
      return Response.json({ error: "claim_invalid_token" }, { status: 400 });
    }
    if (shadow.claimed_at) {
      return Response.json({ error: "claim_already_claimed" }, { status: 400 });
    }
    if (
      shadow.claim_expires_at &&
      new Date(shadow.claim_expires_at).getTime() < Date.now()
    ) {
      return Response.json({ error: "claim_expired" }, { status: 400 });
    }
    claimProfileId = shadow.id;
  }

  let code: string;
  try {
    code = await createAuthCode(claimProfileId);
  } catch (e) {
    console.error("[tg] failed to create auth code", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const deepLink = `https://t.me/${botUsername}?start=login_${code}`;
  return Response.json({ code, deepLink });
}
