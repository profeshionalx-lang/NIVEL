"use server";

import { revalidatePath } from "next/cache";
import { requireTrainerOwnsSession, requireTrainerOwnsCard } from "@/lib/auth/ownership";
import {
  pasteInsightsFromClaudeCore,
  generateAiInsightsCore,
  requeueAiInsightsCore,
  setAiCardTrainerStatusCore,
  deleteAiInsightCardCore,
  updateAiInsightCardCore,
  validateAiInsightCardPatch,
} from "@/lib/core/aiInsights";

export async function pasteInsightsFromClaude(
  sessionId: string,
  markdown: string
): Promise<{ success: true; count: number } | { error: string; line?: number }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Сессия не найдена или нет доступа" };

  const result = await pasteInsightsFromClaudeCore(
    ctx.supabase,
    sessionId,
    ctx.studentId,
    ctx.trainerId,
    markdown
  );

  if ("success" in result) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  return result;
}

export async function generateAiInsights(
  sessionId: string
): Promise<{ success: true; count: number } | { error: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Сессия не найдена или нет доступа" };

  const result = await generateAiInsightsCore(
    ctx.supabase,
    sessionId,
    ctx.studentId,
    ctx.trainerId
  );

  if ("success" in result) {
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/sessions/${sessionId}/transcript`);
    return result;
  }

  // Ревалидируем карточку сессии только если анализ реально менял состояние
  // транскрипта (analysis_status='failed') — как в оригинале. Прекондишн-ошибки
  // (нет транскрипта / анализ уже идёт) ничего не меняли → ревалидации нет.
  if (result.mutated) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  return { error: result.error };
}

/**
 * Ставит транскрипт в очередь на анализ консольным Claude (pm2-демон на машине
 * тренера). Возвращается сразу — результат появится позже, UI поллит статус.
 */
export async function requeueAiInsights(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Сессия не найдена или нет доступа" };

  const result = await requeueAiInsightsCore(ctx.supabase, sessionId);

  if ("success" in result) {
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/sessions/${sessionId}/transcript`);
    return result;
  }

  if (result.mutated) {
    revalidatePath(`/sessions/${sessionId}`);
  }
  return { error: result.error };
}

export async function approveInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const result = await setAiCardTrainerStatusCore(ctx.supabase, cardId, ctx.templateId, "approved");
  if ("success" in result) revalidatePath(`/sessions/${ctx.sessionId}`);
  return result;
}

export async function rejectInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const result = await setAiCardTrainerStatusCore(ctx.supabase, cardId, ctx.templateId, "rejected");
  if ("success" in result) revalidatePath(`/sessions/${ctx.sessionId}`);
  return result;
}

export async function deleteAiInsightCard(
  cardId: string
): Promise<{ success: true } | { error: string }> {
  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const result = await deleteAiInsightCardCore(ctx.supabase, cardId);
  if ("success" in result) revalidatePath(`/sessions/${ctx.sessionId}`);
  return result;
}

export async function updateAiInsightCard(
  cardId: string,
  patch: { title: string; body: string; tag: string; side?: string | null }
): Promise<{ success: true } | { error: string }> {
  // Валидация до проверки владения — сохраняем порядок ошибок оригинала.
  const validationError = validateAiInsightCardPatch(patch);
  if (validationError) return { error: validationError };

  const ctx = await requireTrainerOwnsCard(cardId);
  if (!ctx) return { error: "Forbidden" };

  const result = await updateAiInsightCardCore(ctx.supabase, cardId, ctx.templateId, patch);
  if ("success" in result) revalidatePath(`/sessions/${ctx.sessionId}`);
  return result;
}
