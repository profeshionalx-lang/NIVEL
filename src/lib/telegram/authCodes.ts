import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const CODE_TTL_MIN = 10;

export async function createAuthCode(): Promise<string> {
  const supabase = await createClient();
  // base64url alphabet is [A-Za-z0-9_-] — safe to embed in a t.me deep-link
  // (Telegram start payloads only allow [A-Za-z0-9_-], max 64 chars).
  const code = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();
  const { error } = await supabase.from("telegram_auth_codes").insert({
    code,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createAuthCode failed: ${error.message}`);
  return code;
}

/**
 * Called from the Telegram webhook when a chat that's already linked to a
 * profile opens `/start login_<code>`. Marks the code confirmed so the
 * waiting web page can pick it up and exchange it for a session.
 */
export async function confirmAuthCode(
  code: string,
  profileId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_auth_codes")
    .update({ status: "confirmed", profile_id: profileId, confirmed_at: new Date().toISOString() })
    .eq("code", code)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("code")
    .maybeSingle();
  if (error) {
    console.error("[tg] confirmAuthCode db error", error);
    return false;
  }
  return !!data;
}

/**
 * Called from the polling/exchange endpoint on the web side. Strictly
 * one-time: only a `confirmed` + not-expired code is consumed, and the
 * conditional update guarantees at most one caller ever gets a profileId
 * back (same pattern as consumeLinkToken).
 */
export async function consumeAuthCode(
  code: string
): Promise<{ profileId: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_auth_codes")
    .update({ status: "consumed" })
    .eq("code", code)
    .eq("status", "confirmed")
    .gt("expires_at", new Date().toISOString())
    .select("profile_id")
    .maybeSingle();
  if (error) {
    console.error("[tg] consumeAuthCode db error", error);
    return null;
  }
  if (!data || !data.profile_id) return null;
  return { profileId: data.profile_id as string };
}
