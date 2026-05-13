import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/lib/auth/session";

export type OwnershipContext = {
  user: SessionUser;
  supabase: SupabaseClient;
  studentId: string;
  trainerId: string;
};

/**
 * Verifies that the current session belongs to a trainer who owns the given
 * training session (i.e. the session's goal belongs to a student created by
 * this trainer).
 *
 * Returns an OwnershipContext on success, or null if the check fails (not
 * authenticated, not a trainer, session not found, or not the trainer's student).
 *
 * NOTE: this is a plain module — no "use server" — so it can be imported from
 * both Server Actions and Route Handlers without becoming an RPC endpoint.
 */
export async function requireTrainerOwnsSession(
  sessionId: string
): Promise<OwnershipContext | null> {
  const user = await getSession();
  if (!user || user.role !== "trainer") return null;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, goals!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const goal = (session as unknown as { goals: { user_id: string } }).goals;
  const studentId = goal.user_id;

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", studentId)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!studentProfile) return null;

  return { user, supabase, studentId, trainerId: user.id };
}
