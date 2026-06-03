"use server";

import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { markDashboardSeenCore } from "@/lib/core/dashboard";

/**
 * Marks dashboard data as "seen" for the given user. Only the student themselves
 * may mark their own data.
 */
export async function markDashboardSeen(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };
  if (user.id !== userId) return { success: false, error: "Forbidden" };

  const supabase = await createClient();
  return markDashboardSeenCore(supabase, userId);
}
