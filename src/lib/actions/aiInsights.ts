"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { parseInsightsMarkdown } from "@/lib/ai/parseInsights";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";

export async function pasteInsightsFromClaude(
  sessionId: string,
  markdown: string
): Promise<{ success: true; count: number } | { error: string; line?: number }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Сессия не найдена или нет доступа" };

  const parsed = parseInsightsMarkdown(markdown);
  if (!parsed.ok) {
    return { error: parsed.error, line: parsed.line };
  }

  const { supabase, studentId, trainerId } = ctx;

  const { data, error } = await supabase.rpc("replace_ai_draft_cards", {
    p_session_id: sessionId,
    p_student_id: studentId,
    p_trainer_id: trainerId,
    p_cards: parsed.cards.map((c) => ({
      title: c.title,
      body: c.body,
      quote: c.quote,
      tag: c.tag,
    })),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, count: (data as number) ?? parsed.cards.length };
}

async function requireTrainerOwnsCard(cardId: string) {
  const user = await getSession();
  if (!user || user.role !== "trainer") return null;

  const supabase = await createClient();

  const { data: card } = await supabase
    .from("insight_cards")
    .select("id, session_id, trainer_id")
    .eq("id", cardId)
    .single();

  if (!card || card.trainer_id !== user.id) return null;

  return { supabase, sessionId: card.session_id as string };
}

export async function approveInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const { supabase, sessionId } = ctx;
  const { error } = await supabase
    .from("insight_cards")
    .update({ trainer_status: "approved" })
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function rejectInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const { supabase, sessionId } = ctx;
  const { error } = await supabase
    .from("insight_cards")
    .update({ trainer_status: "rejected" })
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function deleteAiInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const { supabase, sessionId } = ctx;
  const { error } = await supabase
    .from("insight_cards")
    .delete()
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

const VALID_TAGS = new Set(["техника", "тактика", "физика", "ментал"]);
const VALID_SIDES = new Set(["защита", "атака"]);

export async function updateAiInsightCard(
  cardId: string,
  patch: { title: string; body: string; tag: string; side?: string | null }
): Promise<{ success: true } | { error: string }> {
  if (!patch.title.trim()) return { error: "Заголовок обязателен" };
  if (patch.title.trim().length > 80) return { error: "Заголовок не более 80 знаков" };
  if (!patch.body.trim()) return { error: "Описание обязательно" };
  if (patch.body.trim().length > 400) return { error: "Описание не более 400 знаков" };
  if (!VALID_TAGS.has(patch.tag)) return { error: `Недопустимая тема: ${patch.tag}` };
  if (patch.side && !VALID_SIDES.has(patch.side)) {
    return { error: `Недопустимая сторона: ${patch.side}` };
  }

  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const tags = patch.side ? [patch.tag, patch.side] : [patch.tag];

  const { supabase, sessionId } = ctx;
  const { error } = await supabase
    .from("insight_cards")
    .update({
      title: patch.title.trim(),
      body: patch.body.trim(),
      tags,
      front_text: patch.title.trim(),
      context_text: patch.body.trim(),
    })
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}
