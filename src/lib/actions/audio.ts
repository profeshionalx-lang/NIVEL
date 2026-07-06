"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import {
  requestAudioUploadUrlCore,
  enqueueTranscriptionCore,
  getTranscriptStatusCore,
  deleteTranscriptCore,
} from "@/lib/core/audio";

export async function requestAudioUploadUrl(
  sessionId: string,
  ext = "m4a"
): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Forbidden" };

  return requestAudioUploadUrlCore(ctx.supabase, sessionId, ext);
}

/**
 * Ставит аудио в очередь на транскрипцию и возвращает управление сразу
 * (не ждёт Groq). Фоновый pm2-процесс scripts/transcribe-pending.mjs
 * подхватит status='pending' и выполнит STT — см. lib/core/audio.ts.
 */
export async function transcribeSession(
  sessionId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { success: false, error: "Forbidden" };

  const result = await enqueueTranscriptionCore(ctx.supabase, sessionId, storagePath);

  if (result.success) {
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/sessions/${sessionId}/transcript`);
  }
  return result;
}

export async function getTranscriptStatus(sessionId: string): Promise<{
  status: string;
  error_message: string | null;
  analysis_status: string;
  analysis_error: string | null;
} | null> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return null;

  return getTranscriptStatusCore(ctx.supabase, sessionId);
}

export async function resetTranscript(sessionId: string): Promise<void> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return;

  await deleteTranscriptCore(ctx.supabase, sessionId);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/transcript`);
  redirect(`/sessions/${sessionId}`);
}

export async function deleteTranscript(sessionId: string): Promise<void> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return;

  await deleteTranscriptCore(ctx.supabase, sessionId);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/transcript`);
  redirect(`/sessions/${sessionId}`);
}
