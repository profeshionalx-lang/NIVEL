import { createAuthCode } from "@/lib/telegram/authCodes";

export const dynamic = "force-dynamic";

/**
 * Starts the "Login via Telegram" flow: creates a one-time auth code and
 * returns a t.me deep-link with `login_<code>` as the /start payload. The
 * client opens the link, then polls GET /api/auth/telegram/status?code=...
 * until the webhook confirms it (see src/app/api/telegram/webhook/route.ts).
 */
export async function POST(): Promise<Response> {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();
  if (!botUsername) {
    console.error("[tg] TELEGRAM_BOT_USERNAME is not set");
    return Response.json({ error: "misconfigured" }, { status: 500 });
  }

  let code: string;
  try {
    code = await createAuthCode();
  } catch (e) {
    console.error("[tg] failed to create auth code", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const deepLink = `https://t.me/${botUsername}?start=login_${code}`;
  return Response.json({ code, deepLink });
}
