import type { SupabaseClient } from "@supabase/supabase-js";
import { maybeCompleteSessionCore } from "@/lib/core/sessions";
import type { SessionInsightCard } from "@/lib/core/trainerReads";
import { attachFrameUrls, removeFramePaths } from "@/lib/core/frames";
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

/**
 * Deletes an insight card (manual/template-applied path — the "any other
 * card-delete path" from NIVEL#243, separate from `deleteAiInsightCardCore`).
 * Same Storage-cleanup contract: frame paths are collected before the row
 * delete, objects removed after it succeeds, best-effort (see
 * `removeFramePaths`).
 */
export async function deleteInsightCardCore(
  supabase: SupabaseClient,
  cardId: string
): Promise<Ok<{ sessionId: string | null }> | Err> {
  const { data: card } = await supabase
    .from("insight_cards")
    .select("session_id, frame_before_path, frame_after_path")
    .eq("id", cardId)
    .single();

  const { error } = await supabase.from("insight_cards").delete().eq("id", cardId);

  if (error) return { success: false, error: error.message };

  await removeFramePaths(
    supabase,
    [
      card?.frame_before_path as string | null | undefined,
      card?.frame_after_path as string | null | undefined,
    ],
    "deleteInsightCardCore"
  );

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
  const cards = (data ?? []) as unknown as InsightCardWithRelations[];
  return attachFrameUrls(supabase, cards);
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

  // NIVEL#239: `moment_before_seconds`/`moment_after_seconds`/`frame_before_path`/
  // `frame_after_path` are deliberately NOT copied from `template` here (this
  // insert lists columns explicitly, so they land as their column default —
  // NULL). A frame belongs to a specific video of a specific training
  // session; copying it onto another student's card would show that student
  // a moment from someone else's session. Same reasoning applies to
  // `getCardTemplates`/collections — frames never travel with a template.
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

// --- NIVEL#226: read-endpoints для библиотеки шаблонов и коллекций ---

export type TrainerCollection = {
  id: string;
  name: string;
  created_at: string;
  cards_count: number;
};

/**
 * The trainer's card collections with card counts. `cards_count` comes from a
 * single query with the nested `insight_collection_cards` join (embedded
 * relation, no per-collection count query) — no N+1 regardless of how many
 * collections the trainer has.
 */
export async function listTrainerCollectionsCore(
  supabase: SupabaseClient,
  trainerId: string
): Promise<TrainerCollection[]> {
  const { data } = await supabase
    .from("insight_collections")
    .select("id, name, created_at, insight_collection_cards(template_id)")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as Record<string, unknown>[]).map((raw) => ({
    id: raw.id as string,
    name: raw.name as string,
    created_at: raw.created_at as string,
    cards_count: ((raw.insight_collection_cards as unknown[]) ?? []).length,
  }));
}

const INSIGHT_CARD_COLUMNS =
  "id, template_id, title, body, quote, tags, front_text, context_text, source, trainer_status, student_decision, position, created_at";

function mapInsightCardRow(raw: Record<string, unknown>): SessionInsightCard {
  return {
    id: raw.id as string,
    title: (raw.title as string | null) ?? null,
    body: (raw.body as string | null) ?? null,
    quote: (raw.quote as string | null) ?? null,
    tags: (raw.tags as string[] | null) ?? null,
    front_text: (raw.front_text as string | null) ?? null,
    context_text: (raw.context_text as string | null) ?? null,
    source: (raw.source as string | null) ?? null,
    trainer_status: (raw.trainer_status as string | null) ?? null,
    student_decision: (raw.student_decision as string | null) ?? null,
    position: (raw.position as number | null) ?? null,
    created_at: raw.created_at as string,
    // Templates/collections are reusable card definitions, not a specific
    // recording — frames/moments are tied to one session's video and never
    // carry over when a template is applied (NIVEL#235 "не переносятся").
    moment_before_seconds: null,
    moment_after_seconds: null,
    frame_before_url: null,
    frame_after_url: null,
  };
}

/**
 * The cards in a collection: one representative `insight_cards` row per
 * `template_id`, in the collection's stored `position` order. Same DTO shape
 * as `GET /api/v1/sessions/{id}/insight-cards` (`SessionInsightCard`) — the
 * native client reuses that model, per NIVEL#226.
 *
 * `trainerId` scopes the second query — `template_id` is NOT trainer-unique:
 * `aiInsights.ts`'s `saveAiDraftCards` reuses an existing `template_id` by
 * matching `(title, body)` with no `trainer_id` filter ("cards created across
 * multiple students automatically share the same template_id"), and the
 * migration 015 backfill deduped the same way repo-wide. Two different
 * trainers' cards can legitimately share a `template_id`. Without this
 * filter, a collection containing such a shared `template_id` would leak the
 * OTHER trainer's card content (including free-text `front_text`/
 * `context_text`/`quote`) into this trainer's response.
 *
 * Ownership of the collection itself must be checked by the caller
 * (`requireTrainerOwnsCollection`/`collectionBelongsToTrainer`) before
 * calling this — it does not re-verify. Two queries total regardless of
 * collection size (links, then one `.in(template_id)` batch) — no N+1.
 */
export async function getCollectionCardsCore(
  supabase: SupabaseClient,
  collectionId: string,
  trainerId: string
): Promise<SessionInsightCard[]> {
  const { data: links } = await supabase
    .from("insight_collection_cards")
    .select("template_id")
    .eq("collection_id", collectionId)
    .order("position");

  const templateIds = (links ?? []).map((l) => l.template_id as string);
  if (templateIds.length === 0) return [];

  const { data: cards } = await supabase
    .from("insight_cards")
    .select(INSIGHT_CARD_COLUMNS)
    .eq("trainer_id", trainerId)
    .in("template_id", templateIds);

  const byTemplate = new Map<string, Record<string, unknown>>();
  for (const raw of (cards ?? []) as Record<string, unknown>[]) {
    const tid = raw.template_id as string;
    if (!byTemplate.has(tid)) byTemplate.set(tid, raw);
  }

  return templateIds
    .map((tid) => byTemplate.get(tid))
    .filter((raw): raw is Record<string, unknown> => !!raw)
    .map(mapInsightCardRow);
}

export type CardTemplate = SessionInsightCard & { template_id: string };

const TEMPLATE_SEARCH_LIMIT = 50;

/**
 * The trainer's card-template library (what collections are built from): one
 * representative row per distinct `template_id` among the trainer's insight
 * cards. `q` (optional) filters by title substring; empty → first 50
 * alphabetically. Fetches all matching rows and dedupes/caps in application
 * code (not at the query level) — deferring the limit until after dedup is
 * what keeps this correct: a template with many applied copies must not push
 * an older, less-duplicated template out of the first page.
 */
export async function searchCardTemplatesCore(
  supabase: SupabaseClient,
  trainerId: string,
  query: string
): Promise<CardTemplate[]> {
  let q = supabase
    .from("insight_cards")
    .select(INSIGHT_CARD_COLUMNS)
    .eq("trainer_id", trainerId)
    .not("template_id", "is", null)
    .order("title", { ascending: true, nullsFirst: false });

  const trimmed = query.trim();
  if (trimmed) q = q.ilike("title", `%${trimmed}%`);

  const { data } = await q;

  const seen = new Set<string>();
  const templates: CardTemplate[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const templateId = raw.template_id as string;
    if (seen.has(templateId)) continue;
    seen.add(templateId);
    templates.push({ ...mapInsightCardRow(raw), template_id: templateId });
    if (templates.length >= TEMPLATE_SEARCH_LIMIT) break;
  }
  return templates;
}
