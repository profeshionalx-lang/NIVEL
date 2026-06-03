import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Business core for dashboard mutations. Auth-agnostic: the caller verifies the
 * user may act on `userId` and passes a ready `supabase` client. No "use server".
 *
 * NOTE: dashboard *reads* live in `src/lib/dashboard/data.ts` (`loadDashboardData`),
 * which already takes an explicit `userId` and is auth-agnostic by design.
 */

/**
 * Marks dashboard data as "seen" for the given user:
 * - Sets skill_progress.points_seen = points for every skill (so deltas reset to 0).
 * - Sets goals.seen_at = now() for every goal where seen_at IS NULL (so NEW badge clears).
 */
export async function markDashboardSeenCore(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // 1) Snapshot current skill points into points_seen.
    const { data: skills, error: skillsFetchError } = await supabase
      .from("skill_progress")
      .select("id, points")
      .eq("user_id", userId);

    if (skillsFetchError) {
      return { success: false, error: skillsFetchError.message };
    }

    // A per-row update keeps points_seen in sync with the current points value.
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
