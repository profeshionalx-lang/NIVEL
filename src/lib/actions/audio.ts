"use server";

import { postprocessTranscript } from "@/lib/stt/postprocess";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { requireTrainerOwnsSession } from "@/lib/auth/ownership";

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

  const { error: upsertError } = await supabase.from("transcripts").upsert(
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

  if (upsertError) return { success: false, error: upsertError.message };

  try {
    const filename = storagePath.split("/").pop() ?? "audio.m4a";

    const { data: blob, error: downloadError } = await supabase.storage
      .from("session-audio")
      .download(storagePath);

    if (downloadError || !blob) {
      throw new Error(downloadError?.message ?? "Failed to download audio from Storage");
    }

    const audioBuffer = Buffer.from(await blob.arrayBuffer());

    const { transcribeAudio } = await import("@/lib/stt/groq");
    const verboseJson = await transcribeAudio(audioBuffer, filename);

    const { raw_text, segments } = postprocessTranscript(verboseJson);

    await supabase
      .from("transcripts")
      .update({
        raw_text,
        segments_json: segments,
        duration_seconds: verboseJson.duration != null ? Math.round(verboseJson.duration) : null,
        status: "ready",
        error_message: null,
      })
      .eq("session_id", sessionId);

    await supabase.storage.from("session-audio").remove([storagePath]);

    await supabase
      .from("transcripts")
      .update({ storage_path: null })
      .eq("session_id", sessionId);

    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/sessions/${sessionId}/transcript`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("transcripts")
      .update({ status: "failed", error_message: message })
      .eq("session_id", sessionId);
    return { success: false, error: message };
  }
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

export async function resetTranscript(sessionId: string): Promise<void> {
  const ctx = await requireTrainerOwnsSession(sessionId);
  if (!ctx) return;

  const { supabase } = ctx;

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
