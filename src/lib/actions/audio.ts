"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";

export async function requestAudioUploadUrl(
  sessionId: string,
  ext = "m4a"
): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  const user = await getSession();
  if (!user || user.role !== "trainer") return { error: "Forbidden" };

  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id, goals(user_id)")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session not found" };

  const goal = session.goals as unknown as { user_id: string } | null;
  if (!goal) return { error: "Session has no goal" };

  // Ensure student belongs to this trainer
  const { data: studentProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", goal.user_id)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!studentProfile) return { error: "Session not found" };

  const storagePath = `${sessionId}/${randomUUID()}.${ext}`;

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
  const user = await getSession();
  if (!user || user.role !== "trainer") return { success: false, error: "Forbidden" };

  const supabase = await createClient();

  // M4 will replace this stub with real Groq STT logic.
  // For now, create a processing record so the UI can show status.
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
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("transcripts")
    .select("status, error_message")
    .eq("session_id", sessionId)
    .maybeSingle();

  return data ? { status: data.status, error_message: data.error_message } : null;
}
