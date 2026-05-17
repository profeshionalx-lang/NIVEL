"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { maybeCompleteSession } from "@/lib/actions/sessions";
import type {
  InsightCardWithRelations,
  InsightStudentDecision,
} from "@/lib/types";

export interface StudentSessionOption {
  id: string;
  session_number: number;
  trainer_notes: string | null;
  scheduled_at: string | null;
  created_at: string;
}

type Result<T = void> =
  | (T extends void ? { success: true } : { success: true } & T)
  | { success: false; error: string };

async function requireTrainer() {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const supabase = await createClient();
  return { ok: true as const, supabase, userId: user.id };
}

async function requireUser() {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const supabase = await createClient();
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

/** @deprecated Cards are created via AI paste flow only (Epic 5). No UI calls this. */
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

  const { data: lastCard } = await supabase
    .from("insight_cards")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (lastCard?.position ?? 0) + 1;

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
      position: nextPosition,
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
    tags?: string[] | null;
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
  if (patch.tags !== undefined) update.tags = patch.tags;

  const { data: card, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("session_id, template_id")
    .eq("id", cardId)
    .single();

  if (fetchErr || !card) return { success: false, error: fetchErr?.message ?? "Card not found" };

  if (card.template_id) {
    const { error } = await supabase
      .from("insight_cards")
      .update(update)
      .eq("template_id", card.template_id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("insight_cards")
      .update(update)
      .eq("id", cardId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/trainer/sessions/${card.session_id}/insights`);
  return { success: true };
}

export async function setTrainerCardStatus(
  cardId: string,
  status: "approved" | "rejected" | "draft"
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const { data: card, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("session_id, template_id")
    .eq("id", cardId)
    .single();

  if (fetchErr || !card) return { success: false, error: fetchErr?.message ?? "Card not found" };

  if (card.template_id) {
    const { error } = await supabase
      .from("insight_cards")
      .update({ trainer_status: status })
      .eq("template_id", card.template_id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("insight_cards")
      .update({ trainer_status: status })
      .eq("id", cardId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/trainer/sessions/${card.session_id}/insights`);
  revalidatePath(`/sessions/${card.session_id}`);
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

export async function reorderInsightCards(
  sessionId: string,
  orderedIds: string[]
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase } = auth;

  const { data: existing, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("id")
    .eq("session_id", sessionId);

  if (fetchErr) return { success: false, error: fetchErr.message };

  const existingIds = new Set((existing ?? []).map((c) => c.id));
  if (
    orderedIds.length !== existingIds.size ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    return { success: false, error: "Card list is out of sync" };
  }

  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("insight_cards")
      .update({ position: i + 1 })
      .eq("id", orderedIds[i])
      .eq("session_id", sessionId);
    if (error) return { success: false, error: error.message };
  }

  revalidatePath(`/trainer/sessions/${sessionId}/insights`);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/insights`);
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
  const user = await getSession();
  if (!user) return [];

  const supabase = await createClient();
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
    .order("decided_at", { ascending: false })
    .order("position", { ascending: true });

  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.problemId) query = query.eq("problem_id", filters.problemId);

  const { data, error } = await query;
  if (error) {
    console.error("getVaultCards:", error.message);
    return [];
  }
  return (data ?? []) as unknown as InsightCardWithRelations[];
}

export async function getStudentSessions(
  studentId: string
): Promise<StudentSessionOption[]> {
  const user = await getSession();
  if (!user || user.role !== "trainer") return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("sessions")
    .select("id, session_number, trainer_notes, scheduled_at, created_at, goals!inner(user_id)")
    .eq("goals.user_id", studentId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  return ((data ?? []) as unknown as (StudentSessionOption & { goals: { user_id: string } })[]).map(
    ({ goals: _g, ...s }) => s
  );
}

export async function applyTemplateToStudent(
  templateId: string,
  sessionId: string
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, userId } = auth;

  // Get representative card for this template
  const { data: template, error: tErr } = await supabase
    .from("insight_cards")
    .select("*")
    .eq("template_id", templateId)
    .limit(1)
    .single();
  if (tErr || !template) return { success: false, error: "Template not found" };

  // Get student from session
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .select("id, goals!inner(user_id)")
    .eq("id", sessionId)
    .single();
  if (sErr || !session) return { success: false, error: "Session not found" };

  const studentId = (session as unknown as { goals: { user_id: string } }).goals.user_id;

  // Check card not already applied to this student
  const { count } = await supabase
    .from("insight_cards")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId)
    .eq("student_id", studentId);
  if (count && count > 0) return { success: false, error: "Карточка уже есть у этого ученика" };

  const { data: lastCard } = await supabase
    .from("insight_cards")
    .select("position")
    .eq("session_id", sessionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newCard, error: insertErr } = await supabase
    .from("insight_cards")
    .insert({
      session_id: sessionId,
      student_id: studentId,
      trainer_id: userId,
      template_id: templateId,
      title: template.title,
      body: template.body,
      quote: template.quote,
      tags: template.tags,
      front_text: template.front_text,
      context_text: template.context_text,
      problem_id: template.problem_id,
      category_id: template.category_id,
      source: "ai-paste",
      trainer_status: "approved",
      position: (lastCard?.position ?? 0) + 1,
    })
    .select("id")
    .single();

  if (insertErr || !newCard) return { success: false, error: insertErr?.message ?? "Failed" };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, id: newCard.id };
}

export async function createCollection(name: string): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data, error } = await supabase
    .from("insight_collections")
    .insert({ trainer_id: userId, name: name.trim() })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  revalidatePath("/trainer/cards");
  return { success: true, id: data.id };
}

export async function addCardToCollection(
  collectionId: string,
  templateId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("insight_collection_cards")
    .upsert({ collection_id: collectionId, template_id: templateId, position: 0 });

  if (error) return { success: false, error: error.message };
  revalidatePath("/trainer/cards");
  return { success: true };
}

export async function removeCardFromCollection(
  collectionId: string,
  templateId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("insight_collection_cards")
    .delete()
    .eq("collection_id", collectionId)
    .eq("template_id", templateId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/trainer/cards");
  return { success: true };
}

export async function applyCollectionToStudent(
  collectionId: string,
  sessionId: string
): Promise<Result<{ applied: number }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };
  const { supabase, userId } = auth;

  const { data: items } = await supabase
    .from("insight_collection_cards")
    .select("template_id")
    .eq("collection_id", collectionId)
    .order("position");

  let applied = 0;
  for (const item of items ?? []) {
    const result = await applyTemplateToStudent(item.template_id, sessionId);
    if (result.success) applied++;
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, applied };
}
