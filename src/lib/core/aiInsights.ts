import type { SupabaseClient } from "@supabase/supabase-js";
import { parseInsightsMarkdown, type InsightCardDraft } from "@/lib/ai/parseInsights";
import { generateInsightsRaw } from "@/lib/ai/openrouter";

/**
 * Business core for AI insight-card flows (paste / auto-generate / trainer
 * review of draft cards). Auth-agnostic: callers verify ownership of the
 * session/card and pass a ready `supabase` client plus resolved ids. No
 * "use server", no revalidate. The `replace_ai_draft_cards` RPC stays here.
 */

/**
 * Сохраняет распарсенные draft-карточки через RPC replace_ai_draft_cards
 * и назначает template_id новым карточкам. Общий код для ручной вставки
 * (paste) и автоанализа (generate).
 */
export async function saveAiDraftCards(
  supabase: SupabaseClient,
  sessionId: string,
  studentId: string,
  trainerId: string,
  cards: InsightCardDraft[]
): Promise<{ count: number } | { error: string }> {
  const { data, error } = await supabase.rpc("replace_ai_draft_cards", {
    p_session_id: sessionId,
    p_student_id: studentId,
    p_trainer_id: trainerId,
    p_cards: cards.map((c) => ({
      title: c.title,
      body: c.body,
      quote: c.quote,
      tag: c.tag,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  // Assign template_id to newly created cards.
  // Reuse existing template_id if a card with the same title+body already exists,
  // otherwise generate a new one. This ensures cards created across multiple students
  // automatically share the same template_id.
  const { data: newCards } = await supabase
    .from("insight_cards")
    .select("id, title, body")
    .eq("session_id", sessionId)
    .is("template_id", null);

  for (const card of newCards ?? []) {
    let tid: string;
    if (card.title && card.body) {
      const { data: existing } = await supabase
        .from("insight_cards")
        .select("template_id")
        .eq("title", card.title)
        .eq("body", card.body)
        .not("template_id", "is", null)
        .limit(1)
        .maybeSingle();
      tid = existing?.template_id ?? crypto.randomUUID();
    } else {
      tid = crypto.randomUUID();
    }
    await supabase.from("insight_cards").update({ template_id: tid }).eq("id", card.id);
  }

  return { count: (data as number) ?? cards.length };
}

export async function pasteInsightsFromClaudeCore(
  supabase: SupabaseClient,
  sessionId: string,
  studentId: string,
  trainerId: string,
  markdown: string
): Promise<{ success: true; count: number } | { error: string; line?: number }> {
  const parsed = parseInsightsMarkdown(markdown);
  if (!parsed.ok) {
    return { error: parsed.error, line: parsed.line };
  }

  const result = await saveAiDraftCards(supabase, sessionId, studentId, trainerId, parsed.cards);
  if ("error" in result) {
    return { error: result.error };
  }

  return { success: true, count: result.count };
}

/**
 * Автоматический анализ транскрипта через LLM: грузит готовый транскрипт,
 * прогоняет через OpenRouter, парсит ответ и создаёт draft-карточки. Статус
 * анализа пишется в transcripts.analysis_status.
 */
export async function generateAiInsightsCore(
  supabase: SupabaseClient,
  sessionId: string,
  studentId: string,
  trainerId: string
): Promise<{ success: true; count: number } | { error: string }> {
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("status, raw_text, analysis_status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!transcript || transcript.status !== "ready" || !transcript.raw_text?.trim()) {
    return { error: "Транскрипт не готов" };
  }

  // Идемпотентность: не запускаем второй раз, если анализ уже идёт.
  if (transcript.analysis_status === "processing") {
    return { error: "Анализ уже выполняется" };
  }

  await supabase
    .from("transcripts")
    .update({ analysis_status: "processing", analysis_error: null })
    .eq("session_id", sessionId);

  try {
    const raw = await generateInsightsRaw(transcript.raw_text);

    const parsed = parseInsightsMarkdown(raw);
    if (!parsed.ok) {
      throw new Error(`LLM вернул невалидный формат: ${parsed.error}`);
    }

    const result = await saveAiDraftCards(supabase, sessionId, studentId, trainerId, parsed.cards);
    if ("error" in result) {
      throw new Error(result.error);
    }

    await supabase
      .from("transcripts")
      .update({ analysis_status: "ready", analysis_error: null })
      .eq("session_id", sessionId);

    return { success: true, count: result.count };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("transcripts")
      .update({ analysis_status: "failed", analysis_error: message })
      .eq("session_id", sessionId);
    return { error: message };
  }
}

/**
 * Applies a trainer_status to a draft card. If the card has a template_id, the
 * status propagates to every card sharing that template (cross-student).
 */
export async function setAiCardTrainerStatusCore(
  supabase: SupabaseClient,
  cardId: string,
  templateId: string | null,
  status: "approved" | "rejected"
): Promise<{ success: true } | { error: string }> {
  const query = templateId
    ? supabase.from("insight_cards").update({ trainer_status: status }).eq("template_id", templateId)
    : supabase.from("insight_cards").update({ trainer_status: status }).eq("id", cardId);
  const { error } = await query;

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteAiInsightCardCore(
  supabase: SupabaseClient,
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const { error } = await supabase.from("insight_cards").delete().eq("id", cardId);
  if (error) return { error: error.message };
  return { success: true };
}

const VALID_TAGS = new Set(["техника", "тактика", "физика", "менталка"]);
const VALID_SIDES = new Set(["защита", "атака"]);

export function validateAiInsightCardPatch(patch: {
  title: string;
  body: string;
  tag: string;
  side?: string | null;
}): string | null {
  if (!patch.title.trim()) return "Заголовок обязателен";
  if (patch.title.trim().length > 80) return "Заголовок не более 80 знаков";
  if (!patch.body.trim()) return "Описание обязательно";
  if (patch.body.trim().length > 400) return "Описание не более 400 знаков";
  if (!VALID_TAGS.has(patch.tag)) return `Недопустимая тема: ${patch.tag}`;
  if (patch.side && !VALID_SIDES.has(patch.side)) return `Недопустимая сторона: ${patch.side}`;
  return null;
}

export async function updateAiInsightCardCore(
  supabase: SupabaseClient,
  cardId: string,
  templateId: string | null,
  patch: { title: string; body: string; tag: string; side?: string | null }
): Promise<{ success: true } | { error: string }> {
  const validationError = validateAiInsightCardPatch(patch);
  if (validationError) return { error: validationError };

  const tags = patch.side ? [patch.tag, patch.side] : [patch.tag];

  const contentPatch = {
    title: patch.title.trim(),
    body: patch.body.trim(),
    tags,
    front_text: patch.title.trim(),
    context_text: patch.body.trim(),
  };

  const query = templateId
    ? supabase.from("insight_cards").update(contentPatch).eq("template_id", templateId)
    : supabase.from("insight_cards").update(contentPatch).eq("id", cardId);
  const { error } = await query;

  if (error) return { error: error.message };
  return { success: true };
}
