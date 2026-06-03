import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeCompleteSessionCore } from "@/lib/core/sessions";
import type {
  InsightCardWithRelations,
  InsightStudentDecision,
} from "@/lib/types";

/**
 * Business core for insight-card CRUD, reorder, student decisions, vault reads,
 * collections and templates. Auth-agnostic: callers resolve the authenticated
 * user (and role where required) and pass a ready `supabase` client plus the
 * relevant owner id. No "use server", no revalidate — the web wrappers add
 * revalidatePath using the `sessionId` returned where a lookup was needed.
 */

export interface StudentSessionOption {
  id: string;
  session_number: number;
  trainer_notes: string | null;
  scheduled_at: string | null;
  created_at: string;
}

type Ok<T = object> = { success: true } & T;
type Err = { success: false; error: string };

async function resolveCategoryFromProblem(
  supabase: SupabaseClient,
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

/** @deprecated Cards are created via AI paste flow only. No UI calls this. */
export async function createInsightCardCore(
  supabase: SupabaseClient,
  trainerId: string,
  sessionId: string,
  payload: {
    frontText: string;
    contextText?: string | null;
    problemId?: number | null;
  }
): Promise<Ok<{ id: string }> | Err> {
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("id, goal_id, goals!inner(user_id)")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    return { success: false, error: sessionErr?.message ?? "Session not found" };
  }

  const studentId = (session as unknown as { goals: { user_id: string } }).goals.user_id;
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
      trainer_id: trainerId,
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

  return { success: true, id: data.id };
}

export async function updateInsightCardCore(
  supabase: SupabaseClient,
  cardId: string,
  patch: {
    frontText?: string;
    contextText?: string | null;
    problemId?: number | null;
    tags?: string[] | null;
  }
): Promise<Ok<{ sessionId: string }> | Err> {
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

  return { success: true, sessionId: card.session_id as string };
}

export async function setTrainerCardStatusCore(
  supabase: SupabaseClient,
  cardId: string,
  status: "approved" | "rejected" | "draft"
): Promise<Ok<{ sessionId: string }> | Err> {
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

  return { success: true, sessionId: card.session_id as string };
}

export async function deleteInsightCardCore(
  supabase: SupabaseClient,
  cardId: string
): Promise<Ok<{ sessionId: string | null }> | Err> {
  const { data: card } = await supabase
    .from("insight_cards")
    .select("session_id")
    .eq("id", cardId)
    .single();

  const { error } = await supabase.from("insight_cards").delete().eq("id", cardId);

  if (error) return { success: false, error: error.message };

  return { success: true, sessionId: (card?.session_id as string | undefined) ?? null };
}

export async function reorderInsightCardsCore(
  supabase: SupabaseClient,
  sessionId: string,
  orderedIds: string[]
): Promise<Ok | Err> {
  const { data: existing, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("id")
    .eq("session_id", sessionId)
    .in("id", orderedIds);

  if (fetchErr) return { success: false, error: fetchErr.message };

  const existingIds = new Set((existing ?? []).map((c) => c.id));
  if (!orderedIds.every((id) => existingIds.has(id))) {
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

  return { success: true };
}

export async function decideInsightCardCore(
  supabase: SupabaseClient,
  userId: string,
  cardId: string,
  decision: InsightStudentDecision,
  editedText?: string
): Promise<Ok<{ sessionId: string }> | Err> {
  const { data: card, error: fetchErr } = await supabase
    .from("insight_cards")
    .select("id, student_id, trainer_status, session_id")
    .eq("id", cardId)
    .single();

  if (fetchErr || !card) {
    return { success: false, error: fetchErr?.message ?? "Card not found" };
  }
  if (card.student_id !== userId) {
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

  await maybeCompleteSessionCore(supabase, card.session_id);

  return { success: true, sessionId: card.session_id as string };
}

export interface VaultFilters {
  categoryId?: number;
  problemId?: number;
}

export async function getVaultCardsCore(
  supabase: SupabaseClient,
  userId: string,
  filters: VaultFilters = {}
): Promise<InsightCardWithRelations[]> {
  let query = supabase
    .from("insight_cards")
    .select(
      `*,
      problem:problems(id, name),
      category:problem_categories(id, name),
      session:sessions(id, session_number, created_at)`
    )
    .eq("student_id", userId)
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

export async function getStudentSessionsCore(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentSessionOption[]> {
  const { data } = await supabase
    .from("sessions")
    .select("id, session_number, trainer_notes, scheduled_at, created_at, goals!inner(user_id)")
    .eq("goals.user_id", studentId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  return ((data ?? []) as unknown as (StudentSessionOption & { goals: { user_id: string } })[]).map(
    ({ goals: _g, ...s }) => s
  );
}

export async function applyTemplateToStudentCore(
  supabase: SupabaseClient,
  trainerId: string,
  templateId: string,
  sessionId: string
): Promise<Ok<{ id: string }> | Err> {
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
      trainer_id: trainerId,
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

  return { success: true, id: newCard.id };
}

/**
 * Verifies a collection belongs to the given trainer. Used by `/api/v1` to gate
 * mutations on collections by id (the web actions implicitly trust the UI).
 */
export async function collectionBelongsToTrainer(
  supabase: SupabaseClient,
  collectionId: string,
  trainerId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("insight_collections")
    .select("id")
    .eq("id", collectionId)
    .eq("trainer_id", trainerId)
    .maybeSingle();
  return !!data;
}

export async function createCollectionCore(
  supabase: SupabaseClient,
  trainerId: string,
  name: string
): Promise<Ok<{ id: string }> | Err> {
  const { data, error } = await supabase
    .from("insight_collections")
    .insert({ trainer_id: trainerId, name: name.trim() })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  return { success: true, id: data.id };
}

export async function addCardToCollectionCore(
  supabase: SupabaseClient,
  collectionId: string,
  templateId: string
): Promise<Ok | Err> {
  const { error } = await supabase
    .from("insight_collection_cards")
    .upsert({ collection_id: collectionId, template_id: templateId, position: 0 });

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function removeCardFromCollectionCore(
  supabase: SupabaseClient,
  collectionId: string,
  templateId: string
): Promise<Ok | Err> {
  const { error } = await supabase
    .from("insight_collection_cards")
    .delete()
    .eq("collection_id", collectionId)
    .eq("template_id", templateId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function applyCollectionToStudentCore(
  supabase: SupabaseClient,
  trainerId: string,
  collectionId: string,
  sessionId: string
): Promise<Ok<{ applied: number }> | Err> {
  const { data: items } = await supabase
    .from("insight_collection_cards")
    .select("template_id")
    .eq("collection_id", collectionId)
    .order("position");

  let applied = 0;
  for (const item of items ?? []) {
    const result = await applyTemplateToStudentCore(supabase, trainerId, item.template_id, sessionId);
    if (result.success) applied++;
  }

  return { success: true, applied };
}
