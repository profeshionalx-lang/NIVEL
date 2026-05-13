import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n";
import Link from "next/link";
import type { InsightCard } from "@/lib/types";
import { AudioUploader } from "@/components/sessions/AudioUploader";
import { PasteInsightsButton } from "@/components/sessions/PasteInsightsButton";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSession();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const isTrainer = user.role === "trainer";
  const locale = await getLocale();
  const isRu = locale === "ru";
  const nameCol = isRu ? "name_ru" : "name_en";
  const dateLocale = isRu ? "ru-RU" : "en-US";

  const { data: session } = await supabase
    .from("sessions")
    .select("*, goals(user_id)")
    .eq("id", id)
    .single();

  if (!session) redirect("/dashboard");

  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select("*, exercises(name_ru, name_en), session_exercise_skills(skill_id, skills(name_ru, name_en))")
    .eq("session_id", id)
    .order("sort_order");

  const exercises = (sessionExercises || []).map(
    (se: Record<string, unknown>) => {
      const exercise = se.exercises as Record<string, unknown>;
      const skillLinks = (se.session_exercise_skills as Array<Record<string, unknown>>) || [];
      return {
        id: se.id as number,
        name: (exercise?.[nameCol] as string) || "",
        skills: skillLinks.map((sl) => {
          const skill = sl.skills as Record<string, unknown>;
          return {
            id: sl.skill_id as number,
            name: (skill?.[nameCol] as string) || "",
          };
        }),
      };
    }
  );

  const allSkills = [
    ...new Map(
      exercises.flatMap((e) => e.skills).map((s) => [s.id, s])
    ).values(),
  ];

  const { data: transcript } = await supabase
    .from("transcripts")
    .select("status")
    .eq("session_id", id)
    .maybeSingle();

  const { data: cards } = await supabase
    .from("insight_cards")
    .select("*")
    .eq("session_id", id)
    .order("created_at");

  const allCards = (cards ?? []) as InsightCard[];
  const approvedCards = allCards.filter((c) => c.trainer_status === "approved");
  const pendingForStudent = approvedCards.filter(
    (c) => c.student_decision === null
  );
  const takenCards = approvedCards.filter((c) => c.student_decision === "taken");
  const skippedCards = approvedCards.filter((c) => c.student_decision === "skipped");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href="/dashboard" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
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

        <section className="bg-surface-card rounded-3xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">
            {isRu ? "Упражнения" : "Exercises"}
          </p>
          <div className="space-y-3">
            {exercises.map((exercise) => (
              <div key={exercise.id} className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-on-surface">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-60 flex-shrink-0" />
                  {exercise.name}
                </div>
                {exercise.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {exercise.skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="text-[9px] font-black px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-wide"
                      >
                        +{skill.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {exercises.length === 0 && (
              <p className="text-on-surface-variant text-sm">
                {isRu ? "Упражнения ещё не добавлены" : "No exercises added yet"}
              </p>
            )}
          </div>
        </section>

        {allSkills.length > 0 && (
          <section className="bg-surface-high rounded-3xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">
              {isRu ? "Прокачка навыков" : "Skill gains"}
            </p>
            <div className="flex flex-wrap gap-2">
              {allSkills.map((skill) => (
                <span
                  key={skill.id}
                  className="text-xs font-black px-3 py-1.5 rounded-lg bg-primary/10 text-primary"
                >
                  {skill.name} +1
                </span>
              ))}
            </div>
          </section>
        )}

        {isTrainer && (
          <section>
            {transcript ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {isRu ? "Аудио тренировки" : "Session audio"}
                </p>
                <Link
                  href={`/sessions/${id}/transcript`}
                  className="flex items-center gap-3 rounded-2xl bg-surface-card p-4 border border-border-dim"
                >
                  <span className="material-symbols-outlined text-primary">description</span>
                  <div>
                    <p className="text-sm font-bold text-on-surface">
                      {transcript.status === "ready"
                        ? isRu ? "Открыть транскрипт" : "Open transcript"
                        : transcript.status === "processing"
                        ? isRu ? "Транскрипция…" : "Transcribing…"
                        : isRu ? "Ошибка транскрипции" : "Transcription failed"}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {transcript.status === "processing"
                        ? isRu ? "Обычно занимает 15–30 сек" : "Usually takes 15–30 sec"
                        : ""}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant ml-auto">
                    chevron_right
                  </span>
                </Link>
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

          {isTrainer && (
            <PasteInsightsButton sessionId={id} />
          )}

          {isTrainer && (
            <Link
              href={`/trainer/sessions/${id}/insights`}
              className="block rounded-2xl bg-surface-card p-4 border border-border-dim"
            >
              <p className="text-sm font-bold text-on-surface">
                {allCards.length === 0
                  ? isRu ? "Добавить карточки" : "Add insight cards"
                  : `${isRu ? "Карточки" : "Cards"} (${allCards.length})`}
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                {session.trainer_review_completed
                  ? isRu ? "Разбор завершён" : "Review marked as finished"
                  : isRu ? "Разбор в процессе" : "Review still in progress"}
              </p>
            </Link>
          )}

          {!isTrainer && approvedCards.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              {isRu ? "Тренер ещё не поделился карточками." : "Your trainer hasn't shared any insights yet."}
            </p>
          )}

          {!isTrainer && pendingForStudent.length > 0 && (
            <Link
              href={`/sessions/${id}/insights`}
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
                    {c.student_edited_text || c.front_text}
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
                href={`/sessions/${id}/insights?include=skipped`}
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
