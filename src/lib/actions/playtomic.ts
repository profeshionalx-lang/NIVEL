"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseProfileUrl } from "@/lib/playtomic/client";
import { syncUserMatches, addMatchByUrl } from "@/lib/playtomic/sync";

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
        "Не удалось распознать ссылку. Ожидается: https://app.playtomic.io/profile/user/…",
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

export type RefreshMatchesResult = { success: true } | { success: false; error: string };

/**
 * Forces a Playtomic sync for the current user and revalidates /matches.
 */
export async function refreshMatches(): Promise<RefreshMatchesResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  try {
    await syncUserMatches(session.id, { force: true });
  } catch (e) {
    return { success: false, error: String(e) };
  }

  revalidatePath("/matches");
  return { success: true };
}

export type AddMatchByUrlResult = { success: true } | { success: false; error: string };

/**
 * Adds a single match by its Playtomic URL and revalidates /matches.
 */
export async function addMatchByUrlAction(url: string): Promise<AddMatchByUrlResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  const trimmed = url.trim();
  if (!trimmed) return { success: false, error: "URL не может быть пустым" };

  try {
    await addMatchByUrl(session.id, trimmed);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }

  revalidatePath("/matches");
  return { success: true };
}

export type AttachInsightResult = { success: true } | { success: false; error: string };

/**
 * Attaches an insight card to a match (creates a match_goals row).
 */
export async function attachInsightToMatch(
  matchId: string,
  insightId: string
): Promise<AttachInsightResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  const supabase = await createClient();

  // Verify the match belongs to the current user
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .eq("profile_id", session.id)
    .single();

  if (matchError || !match) {
    return { success: false, error: "Match not found" };
  }

  const { error } = await supabase
    .from("match_goals")
    .upsert({ match_id: matchId, insight_id: insightId }, { onConflict: "match_id,insight_id" });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/matches/${matchId}`);
  return { success: true };
}

export type SaveReflectionResult =
  | { success: true }
  | { success: false; error: string };

/**
 * Saves the reflection text for a played match.
 */
export async function saveReflection(
  matchId: string,
  reflection: string
): Promise<SaveReflectionResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("matches")
    .update({ reflection })
    .eq("id", matchId)
    .eq("profile_id", session.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/matches/${matchId}`);
  return { success: true };
}

export type DetachInsightResult = { success: true } | { success: false; error: string };

/**
 * Detaches an insight card from a match (removes the match_goals row).
 */
export async function detachInsightFromMatch(
  matchId: string,
  insightId: string
): Promise<DetachInsightResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "unauthorized" };

  const supabase = await createClient();

  // Verify the match belongs to the current user
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("id")
    .eq("id", matchId)
    .eq("profile_id", session.id)
    .single();

  if (matchError || !match) {
    return { success: false, error: "Match not found" };
  }

  const { error } = await supabase
    .from("match_goals")
    .delete()
    .eq("match_id", matchId)
    .eq("insight_id", insightId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/matches/${matchId}`);
  return { success: true };
}
