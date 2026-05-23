import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const TOKEN_TTL_MIN = 15;

export async function createLinkToken(profileId: string): Promise<string> {
  const supabase = await createClient();
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000).toISOString();
  const { error } = await supabase.from("telegram_link_tokens").insert({
    token,
    profile_id: profileId,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`createLinkToken failed: ${error.message}`);
  return token;
}

export async function consumeLinkToken(
  token: string
): Promise<{ profileId: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("profile_id")
    .maybeSingle();
  if (error || !data) return null;
  return { profileId: data.profile_id as string };
}
