import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { DeleteTranscriptButton } from "./DeleteTranscriptButton";

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
    .select("status, error_message, created_at")
    .eq("session_id", id)
    .maybeSingle();

  if (!transcript) redirect(`/sessions/${id}`);

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
        {transcript.status === "processing" && (
          <div className="rounded-3xl bg-surface-card p-6 text-center space-y-2">
            <span className="material-symbols-outlined text-4xl text-primary block">hourglass_top</span>
            <p className="text-sm font-bold text-on-surface">Транскрипция в процессе…</p>
            <p className="text-xs text-on-surface-variant">Обновите страницу через 15–30 секунд</p>
          </div>
        )}

        {transcript.status === "failed" && (
          <div className="rounded-3xl bg-surface-card p-6 space-y-2">
            <p className="text-sm font-bold text-red-400">Ошибка транскрипции</p>
            {transcript.error_message && (
              <p className="text-xs text-on-surface-variant font-mono">{transcript.error_message}</p>
            )}
            <p className="text-xs text-on-surface-variant mt-3">
              Удалите транскрипт и загрузите аудио заново.
            </p>
          </div>
        )}

        {transcript.status === "ready" && (
          <div className="rounded-3xl bg-surface-card p-6 space-y-2">
            <p className="text-sm font-bold text-primary">Транскрипт готов</p>
            <p className="text-xs text-on-surface-variant">
              Полный просмотр появится в следующем обновлении.
            </p>
          </div>
        )}

        <div className="pt-4 border-t border-border-dim flex justify-center">
          <DeleteTranscriptButton sessionId={id} />
        </div>
      </main>
    </div>
  );
}
