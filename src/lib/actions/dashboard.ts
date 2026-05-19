"use server";

import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks dashboard data as "seen" for the given user:
 * - Sets skill_progress.points_seen = points for every skill (so deltas reset to 0).
 * - Sets goals.seen_at = now() for every goal where seen_at IS NULL (so NEW badge clears).
 *
 * Only the student themselves may mark their own data.
 */
export async function markDashboardSeen(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };
    if (user.id !== userId) return { success: false, error: "Forbidden" };

    const supabase = await createClient();

    // 1) Snapshot current skill points into points_seen.
    const { data: skills, error: skillsFetchError } = await supabase
      .from("skill_progress")
      .select("id, points")
      .eq("user_id", userId);

    if (skillsFetchError) {
      return { success: false, error: skillsFetchError.message };
    }

    // Only update rows where points_seen would actually change is unnecessary —
    // a per-row update keeps points_seen in sync with the current points value.
    for (const sp of skills ?? []) {
      const { error: updError } = await supabase
        .from("skill_progress")
        .update({ points_seen: sp.points })
        .eq("id", sp.id);
      if (updError) {
        return { success: false, error: updError.message };
      }
    }

    // 2) Stamp seen_at on goals the student hasn't seen yet.
    const { error: goalsError } = await supabase
      .from("goals")
      .update({ seen_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("seen_at", null);

    if (goalsError) {
      return { success: false, error: goalsError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
