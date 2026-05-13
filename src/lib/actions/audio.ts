"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";

async function requireTrainerOwnsSession(sessionId: string) {
  const user = await getSession();
  if (!user || user.role !== "trainer") return null;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, goals(user_id)")
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const goal = session.goals as unknown as { user_id: string } | null;
  if (!goal) return null;

  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", goal.user_id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!studentProfile) return null;

  return { user, supabase };
}

const ALLOWED_AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "wav", "ogg", "webm", "mp4", "aac"]);

export async function requestAudioUploadUrl(
  sessionId: string,
  ext = "m4a"
): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { error: "Forbidden" };

  const safeExt = ALLOWED_AUDIO_EXTENSIONS.has(ext.toLowerCase()) ? ext.toLowerCase() : "m4a";
  const { supabase } = ctx;
  const storagePath = `${sessionId}/${randomUUID()}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from("session-audio")
    .createSignedUploadUrl(storagePath);

  if (error || !data) return { error: error?.message ?? "Failed to create upload URL" };

  return { uploadUrl: data.signedUrl, storagePath };
}

export async function transcribeSession(
  sessionId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return { success: false, error: "Forbidden" };

  const { supabase } = ctx;

  // M4 will replace this stub with real Groq STT logic.
  const { error } = await supabase.from("transcripts").upsert(
    {
      session_id: sessionId,
      storage_path: storagePath,
      raw_text: "",
      segments_json: [],
      stt_provider: "groq",
      stt_model: "whisper-large-v3",
      status: "processing",
    },
    { onConflict: "session_id" }
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true };
}

export async function getTranscriptStatus(
  sessionId: string
): Promise<{ status: string; error_message: string | null } | null> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return null;

  const { data } = await ctx.supabase
    .from("transcripts")
    .select("status, error_message")
    .eq("session_id", sessionId)
    .maybeSingle();

  return data ? { status: data.status, error_message: data.error_message } : null;
}

export async function deleteTranscript(sessionId: string): Promise<void> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return;

  const { supabase } = ctx;

  // If there's a leftover storage file (upload failed mid-transcription), clean it up.
  const { data: existing } = await supabase
    .from("transcripts")
    .select("storage_path")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing?.storage_path) {
    await supabase.storage.from("session-audio").remove([existing.storage_path]);
  }

  await supabase.from("transcripts").delete().eq("session_id", sessionId);

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/transcript`);
  redirect(`/sessions/${sessionId}`);
}
