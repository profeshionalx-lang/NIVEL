import { consumeAuthCode, isAuthCodePending } from "@/lib/telegram/authCodes";
import { createSessionForProfile } from "@/lib/auth/session";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Polled by the /login page while waiting for the user to press Start in
 * Telegram. Statuses:
 *  - "ok"      — code was confirmed by the webhook; session cookie is set
 *                here and the caller should redirect to /dashboard.
 *  - "pending" — not confirmed yet, keep polling.
 *  - "expired" — code missing/expired/already consumed; stop polling.
 *
 * Never returns the profile_id to the client.
 */
export async function GET(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const limit = rateLimit(`telegram-status:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limit.ok) return tooManyRequests(limit.retryAfterMs);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();
  if (!code) {
    return Response.json({ status: "expired" }, { status: 400 });
  }

  const consumed = await consumeAuthCode(code);
  if (!consumed) {
    // Not confirmed yet (or already consumed) — check whether it's still a
    // live pending code before deciding whether to keep polling.
    const pending = await isAuthCodePending(code);
    return Response.json({ status: pending ? "pending" : "expired" });
  }

  try {
    await createSessionForProfile(consumed.profileId);
  } catch (e) {
    console.error("[tg] failed to create session for profile", e);
    return Response.json({ status: "expired" }, { status: 500 });
  }

  return Response.json({ status: "ok" });
}
