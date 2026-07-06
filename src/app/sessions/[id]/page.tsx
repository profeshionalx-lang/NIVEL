export const maxDuration = 300;

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n";
import Link from "next/link";
import type { InsightCard } from "@/lib/types";
import { AudioUploader } from "@/components/sessions/AudioUploader";
import { PasteInsightsButton } from "@/components/sessions/PasteInsightsButton";
import { InsightsAnalysisStatus } from "@/components/sessions/InsightsAnalysisStatus";
import { DraftCardsList } from "@/components/insights/DraftCardsList";
import { ApprovedCardsReorderable } from "@/components/insights/ApprovedCardsReorderable";
import BackButton from "@/components/navigation/BackButton";
import { DownloadTranscriptButton } from "./transcript/DownloadTranscriptButton";

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { id } = await params;
  const { as } = await searchParams;
  const user = await getSession();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const previewAsStudent = user.role === "trainer" && as === "student";
  const isTrainer = user.role === "trainer" && !previewAsStudent;
  const locale = await getLocale();
  const isRu = locale === "ru";
  const dateLocale = isRu ? "ru-RU" : "en-US";

  const { data: session } = await supabase
    .from("sessions")
    .select("*, goals(user_id)")
    .eq("id", id)
    .single();

  if (!session) redirect("/dashboard");

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("status, raw_text, analysis_status, analysis_error")
    .eq("session_id", id)
    .maybeSingle();

  const { data: cards } = await supabase
    .from("insight_cards")
    .select("*")
    .eq("session_id", id)
    .order("position");

  const allCards = (cards ?? []) as InsightCard[];
  const draftCards = allCards.filter((c) => c.trainer_status === "draft");
  const approvedCards = allCards.filter((c) => c.trainer_status === "approved");
  const pendingForStudent = approvedCards.filter(
    (c) => c.student_decision === null
  );
  const takenCards = approvedCards.filter((c) => c.student_decision === "taken");
  const skippedCards = approvedCards.filter((c) => c.student_decision === "skipped");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <BackButton
          fallbackHref={
            previewAsStudent && session.goals?.user_id
              ? `/trainer/students/${session.goals.user_id}/preview`
              : "/dashboard"
          }
        />
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          {isRu ? "Сессия" : "Session"} {session.session_number}
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-[430px] mx-auto space-y-6">
        <div>
          <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mb-1">
            {session.status === "completed"
              ? isRu ? "Завершена" : "Completed"
              : isRu ? "Запланирована" : "Planned"}
          </p>
          <h1 className="text-3xl font-black tracking-tighter">
            {isRu ? "Сессия" : "Session"} {session.session_number}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {new Date(session.created_at).toLocaleDateString(dateLocale, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {isTrainer && (
          <section>
            {transcript ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {isRu ? "Аудио тренировки" : "Session audio"}
                </p>
                {transcript.status === "ready" ? (
                  <div className="flex items-center gap-3 rounded-2xl bg-surface-card p-4 border border-border-dim">
                    <span className="material-symbols-outlined text-primary">description</span>
                    <p className="flex-1 text-sm font-bold text-on-surface">
                      {isRu ? "Транскрипт готов" : "Transcript ready"}
                    </p>
                    <DownloadTranscriptButton sessionId={id} rawText={transcript.raw_text} />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-surface-card p-4 border border-border-dim">
                    <span className="material-symbols-outlined text-on-surface-variant">
                      {transcript.status === "pending" || transcript.status === "processing"
                        ? "hourglass_top"
                        : "error"}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {transcript.status === "pending"
                          ? isRu ? "В очереди на транскрипцию…" : "Queued for transcription…"
                          : transcript.status === "processing"
                          ? isRu ? "Транскрипция…" : "Transcribing…"
                          : isRu ? "Ошибка транскрипции" : "Transcription failed"}
                      </p>
                      {(transcript.status === "pending" || transcript.status === "processing") && (
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {isRu ? "Обычно занимает 1–2 минуты" : "Usually takes 1–2 minutes"}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <AudioUploader sessionId={id} />
            )}
          </section>
        )}

        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            {isRu ? "Карточки" : "Insights"}
          </p>

          {isTrainer && transcript && (
            <InsightsAnalysisStatus
              sessionId={id}
              transcriptStatus={transcript.status}
              initialAnalysisStatus={transcript.analysis_status ?? "idle"}
              initialAnalysisError={transcript.analysis_error ?? null}
            />
          )}

          {isTrainer && (
            <PasteInsightsButton sessionId={id} />
          )}

          {isTrainer && draftCards.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                {isRu ? `Черновики (${draftCards.length})` : `Drafts (${draftCards.length})`}
              </p>
              <DraftCardsList cards={draftCards} isTrainer={isTrainer} />
            </div>
          )}

          {isTrainer && approvedCards.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {isRu ? `Approved (${approvedCards.length})` : `Approved (${approvedCards.length})`}
              </p>
              <ApprovedCardsReorderable sessionId={id} cards={approvedCards} />
            </div>
          )}

          {isTrainer && draftCards.length === 0 && approvedCards.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              {isRu ? "Карточек пока нет — вставьте инсайты выше." : "No cards yet — paste insights above."}
            </p>
          )}

          {!isTrainer && approvedCards.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              {isRu ? "Тренер ещё не поделился карточками." : "Your trainer hasn't shared any insights yet."}
            </p>
          )}

          {!isTrainer && pendingForStudent.length > 0 && (
            <Link
              href={`/sessions/${id}/insights${previewAsStudent ? "?as=student" : ""}`}
              className="block rounded-2xl kinetic-gradient text-on-primary p-4 glow-primary"
            >
              <p className="font-black text-base">
                {isRu
                  ? `Тренер прислал ${pendingForStudent.length} ${pendingForStudent.length === 1 ? "карточку" : "карточек"}`
                  : `Trainer sent ${pendingForStudent.length} ${pendingForStudent.length === 1 ? "insight" : "insights"}`}
              </p>
              <p className="text-xs mt-1 opacity-80">{isRu ? "Нажмите, чтобы разобрать →" : "Tap to review →"}</p>
            </Link>
          )}

          {!isTrainer && approvedCards.length > 0 && pendingForStudent.length === 0 && (
            <p className="text-xs text-on-surface-variant uppercase tracking-widest">
              {isRu ? "Все карточки разобраны" : "All cards reviewed"}
            </p>
          )}

          {takenCards.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                {isRu ? "Взято" : "Taken"} ({takenCards.length})
              </p>
              {takenCards.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl bg-surface-card p-3 border-l-2 border-primary"
                >
                  <p className="text-sm text-on-surface">
                    {c.student_edited_text || c.title || c.front_text}
                  </p>
                </div>
              ))}
            </div>
          )}

          {skippedCards.length > 0 && !isTrainer && (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                {isRu
                  ? `Пропущено (${skippedCards.length}) — можно вернуться в любой момент`
                  : `Skipped (${skippedCards.length}) — review again any time`}
              </p>
              <Link
                href={`/sessions/${id}/insights?include=skipped${previewAsStudent ? "&as=student" : ""}`}
                className="block text-xs text-secondary font-bold uppercase tracking-wider"
              >
                {isRu ? "Открыть пропущенные →" : "Re-open skipped →"}
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
