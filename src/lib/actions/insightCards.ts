"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { maybeCompleteSession } from "@/lib/actions/sessions";
import type {
  InsightCardWithRelations,
  InsightStudentDecision,
} from "@/lib/types";

type Result<T = void> =
  | (T extends void ? { success: true } : { success: true } & T)
  | { success: false; error: string };

async function requireTrainer() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "trainer") {
    return { ok: false as const, error: "Trainer role required" };
  }
  return { ok: true as const, supabase, userId: user.id };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  return { ok: true as const, supabase, userId: user.id };
}

async function resolveCategoryFromProblem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  problemId: number | null
): Promise<number | null> {
  if (!problemId) return null;
  const { data } = await supabase
    .from("problems")
    .select("category_id")
    .eq("id", problemId)
    .single();
  return data?.category_id ?? null;
}

export async function createInsightCard(
  sessionId: string,
  payload: {
    frontText: string;
    contextText?: string | null;
    problemId?: number | null;
  }
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, goal_id, goals!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return { success: false, error: sessionErr?.message ?? "Session not found" };
  }

  const studentId = (session as unknown as { goals: { user_id: string } }).goals
    .user_id;
  const categoryId = await resolveCategoryFromProblem(supabase, payload.problemId ?? null);

  const { data, error } = await supabase
    .from("insight_cards")
    .insert({
      session_id: sessionId,
      student_id: studentId,
      trainer_id: auth.userId,
      problem_id: payload.problemId ?? null,
      category_id: categoryId,
      front_text: payload.frontText.trim(),
      context_text: payload.contextText?.trim() || null,
      source: "manual",
      trainer_status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message ?? "Failed to create card" };
  }

  revalidatePath(`/trainer/sessions/${sessionId}/insights`);
  return { success: true, id: data.id };
}

export async function updateInsightCard(
  cardId: string,
  patch: {
    frontText?: string;
    contextText?: string | null;
    problemId?: number | null;
  }
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const update: Record<string, unknown> = {};
  if (patch.frontText !== undefined) update.front_text = patch.frontText.trim();
  if (patch.contextText !== undefined)
    update.context_text = patch.contextText?.trim() || null;
  if (patch.problemId !== undefined) {
    update.problem_id = patch.problemId;
    update.category_id = await resolveCategoryFromProblem(supabase, patch.problemId);
  }

  const { data, error } = await supabase
    .from("insight_cards")
    .update(update)
    .eq("id", cardId)
    .select("session_id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/trainer/sessions/${data.session_id}/insights`);
  return { success: true };
}

export async function setTrainerCardStatus(
  cardId: string,
  status: "approved" | "rejected" | "draft"
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
    .from("insight_cards")
    .update({ trainer_status: status })
    .eq("id", cardId)
    .select("session_id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath(`/trainer/sessions/${data.session_id}/insights`);
  revalidatePath(`/sessions/${data.session_id}`);
  return { success: true };
}

export async function deleteInsightCard(cardId: string): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { data: card } = await auth.supabase
    .from("insight_cards")
    .select("session_id")
    .eq("id", cardId)
    .single();

  const { error } = await auth.supabase
    .from("insight_cards")
    .delete()
    .eq("id", cardId);

  if (error) return { success: false, error: error.message };

  if (card?.session_id) {
    revalidatePath(`/trainer/sessions/${card.session_id}/insights`);
  }
  return { success: true };
}

export async function decideInsightCard(
  cardId: string,
  decision: InsightStudentDecision,
  editedText?: string
): Promise<Result> {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const { data: card, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("id, student_id, trainer_status, session_id")
    .eq("id", cardId)
    .single();

  if (fetchErr || !card) {
    return { success: false, error: fetchErr?.message ?? "Card not found" };
  }
  if (card.student_id !== auth.userId) {
    return { success: false, error: "Forbidden" };
  }
  if (card.trainer_status !== "approved") {
    return { success: false, error: "Card is not yet approved" };
  }

  const { error } = await supabase
    .from("insight_cards")
    .update({
      student_decision: decision,
      decided_at: new Date().toISOString(),
      student_edited_text:
        decision === "taken" && editedText?.trim() ? editedText.trim() : null,
    })
    .eq("id", cardId);

  if (error) return { success: false, error: error.message };

  await maybeCompleteSession(card.session_id);

  revalidatePath(`/sessions/${card.session_id}`);
  revalidatePath(`/sessions/${card.session_id}/insights`);
  revalidatePath("/insights");
  revalidatePath("/dashboard");
  return { success: true };
}

export interface VaultFilters {
  categoryId?: number;
  problemId?: number;
}

export async function getVaultCards(
  filters: VaultFilters = {}
): Promise<InsightCardWithRelations[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("insight_cards")
    .select(
      `*,
      problem:problems(id, name),
      category:problem_categories(id, name),
      session:sessions(id, session_number, created_at)`
    )
    .eq("student_id", user.id)
    .eq("student_decision", "taken")
    .order("decided_at", { ascending: false });

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.problemId) query = query.eq("problem_id", filters.problemId);

  const { data, error } = await query;
  if (error) {
    console.error("getVaultCards:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InsightCardWithRelations[];
}
