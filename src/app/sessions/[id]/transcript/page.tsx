import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { DeleteTranscriptButton } from "./DeleteTranscriptButton";
import { TranscriptView } from "./TranscriptView";

export default async function TranscriptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const supabase = await createClient();

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("status, error_message, raw_text, segments_json, duration_seconds, created_at")
    .eq("session_id", id)
    .maybeSingle();

  if (!transcript) redirect(`/sessions/${id}`);

  const segments = Array.isArray(transcript.segments_json)
    ? (transcript.segments_json as Array<{
        id: number;
        start: number;
        end: number;
        text: string;
        avg_logprob?: number;
      }>)
    : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href={`/sessions/${id}`} className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Транскрипт
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-[430px] mx-auto space-y-6">
        <TranscriptView
          sessionId={id}
          status={transcript.status}
          errorMessage={transcript.error_message}
          rawText={transcript.raw_text}
          segments={segments}
        />

        <div className="pt-4 border-t border-border-dim flex justify-center">
          <DeleteTranscriptButton sessionId={id} />
        </div>
      </main>
    </div>
  );
}
