"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parseInsightsMarkdown } from "@/lib/ai/parseInsights";

async function requireTrainerOwnsSession(sessionId: string) {
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

  const { error: deleteError } = await supabase
    .from("insight_cards")
    .delete()
    .eq("session_id", sessionId)
    .eq("trainer_status", "draft")
    .eq("source", "ai-paste");

  if (deleteError) {
    return { error: deleteError.message };
  }

  const rows = parsed.cards.map((card) => ({
    session_id: sessionId,
    student_id: studentId,
    trainer_id: trainerId,
    source: "ai-paste" as const,
    trainer_status: "draft" as const,
    front_text: card.title,
    context_text: card.body,
    title: card.title,
    body: card.body,
    quote: card.quote,
    tags: [card.tag],
  }));

  const { error: insertError } = await supabase
    .from("insight_cards")
    .insert(rows);

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, count: parsed.cards.length };
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

const VALID_TAGS = new Set(["техника", "тактика", "физика", "ментал"]);

export async function updateAiInsightCard(
  cardId: string,
  patch: { title: string; body: string; tag: string }
): Promise<{ success: true } | { error: string }> {
  if (!patch.title.trim()) return { error: "Заголовок обязателен" };
  if (patch.title.trim().length > 80) return { error: "Заголовок не более 80 знаков" };
  if (!patch.body.trim()) return { error: "Описание обязательно" };
  if (patch.body.trim().length > 400) return { error: "Описание не более 400 знаков" };
  if (!VALID_TAGS.has(patch.tag)) return { error: `Недопустимая тема: ${patch.tag}` };

  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const { supabase, sessionId } = ctx;
  const { error } = await supabase
    .from("insight_cards")
    .update({
      title: patch.title.trim(),
      body: patch.body.trim(),
      tags: [patch.tag],
      front_text: patch.title.trim(),
    })
    .eq("id", cardId);

  if (error) return { error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}
