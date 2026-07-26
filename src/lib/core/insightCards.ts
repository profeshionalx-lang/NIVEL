import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeCompleteSessionCore } from "@/lib/core/sessions";
import type {
  CardTemplate,
  InsightCardWithRelations,
  InsightStudentDecision,
  InsightTrainerStatus,
} from "@/lib/types";
import type { SessionInsightCard } from "@/lib/core/trainerReads";

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

export type CollectionListItem = {
  id: string;
  name: string;
  cards_count: number;
  created_at: string;
};

/**
 * Collections owned by the trainer, with `cards_count` computed via the
 * embedded `insight_collection_cards(count)` aggregate — a single query, no
 * per-collection follow-up. Mirrors what `/trainer/cards` shows.
 */
export async function listCollectionsCore(
  supabase: SupabaseClient,
  trainerId: string
): Promise<CollectionListItem[]> {
  const { data } = await supabase
    .from("insight_collections")
    .select("id, name, created_at, insight_collection_cards(count)")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    created_at: c.created_at as string,
    cards_count:
      ((c.insight_collection_cards as { count: number }[] | null)?.[0]?.count as
        | number
        | undefined) ?? 0,
  }));
}

/**
 * Cards contained in a collection, in position order. Each collection item is
 * a `template_id` — content lives on the representative `insight_cards` row
 * with that `template_id`. Two queries total (item list, then a batched
 * `in()` lookup), no N+1. Field shape matches `SessionInsightCard` so native
 * clients reuse the same DTO as `GET /api/v1/sessions/{id}/insight-cards`.
 */
export async function getCollectionCardsCore(
  supabase: SupabaseClient,
  collectionId: string
): Promise<SessionInsightCard[]> {
  const { data: items } = await supabase
    .from("insight_collection_cards")
    .select("template_id")
    .eq("collection_id", collectionId)
    .order("position");

  const templateIds = (items ?? []).map((i) => i.template_id as string);
  if (templateIds.length === 0) return [];

  const { data: cards } = await supabase
    .from("insight_cards")
    .select(
      "id, title, body, quote, tags, front_text, context_text, source, trainer_status, student_decision, position, created_at, template_id"
    )
    .in("template_id", templateIds);

  const byTemplate = new Map<string, Record<string, unknown>>();
  for (const c of cards ?? []) {
    const key = c.template_id as string;
    if (!byTemplate.has(key)) byTemplate.set(key, c);
  }

  return templateIds
    .map((tid) => byTemplate.get(tid))
    .filter((c): c is Record<string, unknown> => !!c)
    .map((c) => ({
      id: c.id as string,
      title: (c.title as string | null) ?? null,
      body: (c.body as string | null) ?? null,
      quote: (c.quote as string | null) ?? null,
      tags: (c.tags as string[] | null) ?? null,
      front_text: (c.front_text as string | null) ?? null,
      context_text: (c.context_text as string | null) ?? null,
      source: (c.source as string | null) ?? null,
      trainer_status: (c.trainer_status as string | null) ?? null,
      student_decision: (c.student_decision as string | null) ?? null,
      position: (c.position as number | null) ?? null,
      created_at: c.created_at as string,
    }));
}

/**
 * Card template library for a trainer — the same dedup-by-template_id logic
 * as `/trainer/cards`' page loader, but query-side: fetches only the trainer's
 * cards, then aggregates per template in memory. `q` filters by substring on
 * title/body (case-insensitive), capped at 50 results.
 */
export async function listCardTemplatesCore(
  supabase: SupabaseClient,
  trainerId: string,
  q?: string,
  limit = 50
): Promise<CardTemplate[]> {
  let query = supabase
    .from("insight_cards")
    .select("id, template_id, title, body, quote, tags, trainer_status, created_at, student_id, student_decision")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`title.ilike.${term},body.ilike.${term}`);
  }

  const { data } = await query;

  const templateMap = new Map<string, CardTemplate>();
  for (const card of data ?? []) {
    const key = (card.template_id as string | null) ?? (card.id as string);
    if (!templateMap.has(key)) {
      templateMap.set(key, {
        id: card.id as string,
        template_id: card.template_id as string | null,
        title: card.title as string | null,
        body: card.body as string | null,
        quote: card.quote as string | null,
        tags: card.tags as string[] | null,
        trainer_status: card.trainer_status as InsightTrainerStatus,
        created_at: card.created_at as string,
        student_count: 0,
        taken_count: 0,
        skipped_count: 0,
        pending_count: 0,
      });
    }
    const t = templateMap.get(key)!;
    t.student_count++;
    if (card.student_decision === "taken") t.taken_count++;
    else if (card.student_decision === "skipped") t.skipped_count++;
    else t.pending_count++;
  }

  return Array.from(templateMap.values()).slice(0, limit);
}
