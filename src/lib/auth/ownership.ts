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

export type TrainerContext = { user: SessionUser; supabase: SupabaseClient };

/**
 * Verifies the current session is a trainer. Returns { user, supabase } or null.
 * For trainer-scoped read endpoints that aren't tied to a single session.
 * Plain module (no "use server") — shared by Server Actions and Route Handlers.
 */
export async function requireTrainer(): Promise<TrainerContext | null> {
  const user = await getSession();
  if (!user || user.role !== "trainer") return null;
  const supabase = await createClient();
  return { user, supabase };
}

export type CardOwnershipContext = {
  user: SessionUser;
  supabase: SupabaseClient;
  sessionId: string;
  templateId: string | null;
};

/**
 * Verifies that the current session belongs to the trainer who owns the given
 * insight card (card.trainer_id === user.id). Returns a CardOwnershipContext on
 * success, or null otherwise (not a trainer, card missing, or not the owner).
 *
 * Plain module (no "use server") so it can be shared by Server Actions and
 * Route Handlers alike.
 */
export async function requireTrainerOwnsCard(
  cardId: string
): Promise<CardOwnershipContext | null> {
  const user = await getSession();
  if (!user || user.role !== "trainer") return null;

  const supabase = await createClient();

  const { data: card } = await supabase
    .from("insight_cards")
    .select("id, session_id, trainer_id, template_id")
    .eq("id", cardId)
    .single();

  if (!card || card.trainer_id !== user.id) return null;

  return {
    user,
    supabase,
    sessionId: card.session_id as string,
    templateId: card.template_id as string | null,
  };
}
