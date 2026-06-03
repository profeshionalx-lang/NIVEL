import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { postprocessTranscript } from "@/lib/stt/postprocess";

/**
 * Business core for the audio → transcript pipeline. Auth-agnostic: callers
 * (web action / `/api/v1`) must verify ownership of `sessionId` and pass a
 * ready `supabase` client. No "use server", no revalidate/redirect.
 */

const ALLOWED_AUDIO_EXTENSIONS = new Set(["m4a", "mp3", "wav", "ogg", "webm", "mp4", "aac"]);

export async function requestAudioUploadUrlCore(
  supabase: SupabaseClient,
  sessionId: string,
  ext = "m4a"
): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const safeExt = ALLOWED_AUDIO_EXTENSIONS.has(ext.toLowerCase()) ? ext.toLowerCase() : "m4a";
  const storagePath = `${sessionId}/${randomUUID()}.${safeExt}`;

  const { data, error } = await supabase.storage
    .from("session-audio")
    .createSignedUploadUrl(storagePath);

  if (error || !data) return { error: error?.message ?? "Failed to create upload URL" };

  return { uploadUrl: data.signedUrl, storagePath };
}

export async function transcribeSessionCore(
  supabase: SupabaseClient,
  sessionId: string,
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
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
        // Анализ запускается отдельным шагом (generateAiInsights), который
        // триггерит UI после того как увидит status='ready'. См. план Фазы 1.
        analysis_status: "idle",
        analysis_error: null,
      })
      .eq("session_id", sessionId);

    await supabase.storage.from("session-audio").remove([storagePath]);

    await supabase
      .from("transcripts")
      .update({ storage_path: null })
      .eq("session_id", sessionId);

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

export async function getTranscriptStatusCore(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{
  status: string;
  error_message: string | null;
  analysis_status: string;
  analysis_error: string | null;
} | null> {
  const { data } = await supabase
    .from("transcripts")
    .select("status, error_message, analysis_status, analysis_error")
    .eq("session_id", sessionId)
    .maybeSingle();

  return data
    ? {
        status: data.status,
        error_message: data.error_message,
        analysis_status: data.analysis_status ?? "idle",
        analysis_error: data.analysis_error ?? null,
      }
    : null;
}

/**
 * Removes the transcript row (and any leftover storage file) for a session.
 * Shared by both reset and delete flows — the web wrappers add revalidate+redirect.
 */
export async function deleteTranscriptCore(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("transcripts")
    .select("storage_path")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existing?.storage_path) {
    await supabase.storage.from("session-audio").remove([existing.storage_path]);
  }

  await supabase.from("transcripts").delete().eq("session_id", sessionId);
}
