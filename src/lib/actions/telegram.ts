"use server";

import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createLinkToken } from "@/lib/telegram/tokens";

export type StartLinkResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function startTelegramLink(): Promise<StartLinkResult> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    return { success: false, error: "TELEGRAM_BOT_USERNAME is not set" };
  }

  try {
    const token = await createLinkToken(user.id);
    return { success: true, url: `https://t.me/${botUsername}?start=${token}` };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to create token" };
  }
}

export async function unlinkTelegram(): Promise<{ success: boolean; error?: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("telegram_links")
    .update({ is_active: false })
    .eq("profile_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
