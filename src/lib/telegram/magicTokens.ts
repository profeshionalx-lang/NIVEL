import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const TOKEN_TTL_HOURS = 24;

/**
 * Only allow relative, same-origin paths as redirect targets. Rejects
 * absolute URLs, protocol-relative (`//evil.com`) and backslash tricks
 * (`/\evil.com`) that browsers can interpret as scheme-relative.
 */
export function isSafeNextPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (path.startsWith("/\\")) return false;
  return true;
}

export async function createMagicToken(
  profileId: string,
  nextPath: string
): Promise<string> {
  if (!isSafeNextPath(nextPath)) {
    throw new Error(`createMagicToken: unsafe nextPath "${nextPath}"`);
  }
  const supabase = await createClient();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60_000).toISOString();
  const { error } = await supabase.from("telegram_magic_tokens").insert({
    token,
    profile_id: profileId,
    next_path: nextPath,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createMagicToken failed: ${error.message}`);
  return token;
}

export async function consumeMagicToken(
  token: string
): Promise<{ profileId: string; nextPath: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_magic_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("profile_id, next_path")
    .maybeSingle();
  if (error) {
    console.error("[tg] consumeMagicToken db error", error);
    return null;
  }
  if (!data) return null;

  const nextPath = data.next_path as string;
  if (!isSafeNextPath(nextPath)) {
    // Defense in depth: a bad value should never have been stored, but
    // never redirect to it if it somehow was.
    return { profileId: data.profile_id as string, nextPath: "/dashboard" };
  }
  return { profileId: data.profile_id as string, nextPath };
}
