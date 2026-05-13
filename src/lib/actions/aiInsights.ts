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
