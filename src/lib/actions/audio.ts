"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";
import {
  requestAudioUploadUrlCore,
  transcribeSessionCore,
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

export async function transcribeSession(
  sessionId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { success: false, error: "Forbidden" };

  const result = await transcribeSessionCore(ctx.supabase, sessionId, storagePath);

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
