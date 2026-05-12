"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseProfileUrl } from "@/lib/playtomic/client";
import { syncUserMatches } from "@/lib/playtomic/sync";

export type ConnectPlaytomicResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Validates the given Playtomic profile URL, writes playtomic_user_id to the
 * current user's profile, triggers a forced match sync, then redirects to /matches.
 */
export async function connectPlaytomicProfile(
  url: string
): Promise<ConnectPlaytomicResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  const trimmed = url.trim();
  const userId = parseProfileUrl(trimmed);
  if (!userId) {
    return {
      success: false,
      error:
        "Не удалось распознать ссылку. Ожидается: https://app.playtomic.io/profile/users/…",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ playtomic_user_id: userId })
    .eq("id", session.id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Force sync — fire-and-forget errors; user can retry on /matches
  try {
    await syncUserMatches(session.id, { force: true });
  } catch {
    // non-fatal — profile is saved, matches will sync on next visit
  }

  redirect("/matches");
}
