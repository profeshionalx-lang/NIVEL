import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import InsightForm from "@/components/sessions/InsightForm";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isTrainer = profile?.role === "trainer";

  // Fetch session with goal info
  const { data: session } = await supabase
    .from("sessions")
    .select("*, goals(user_id, session_count)")
    .eq("id", id)
    .single();

  if (!session) redirect("/dashboard");

  // Fetch exercises with skills
  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select("*, exercises(name), session_exercise_skills(skill_id, skills(name))")
    .eq("session_id", id)
    .order("sort_order");

  const exercises = (sessionExercises || []).map(
    (se: Record<string, unknown>) => {
      const exercise = se.exercises as Record<string, unknown>;
      const skillLinks = (se.session_exercise_skills as Array<Record<string, unknown>>) || [];
      return {
        id: se.id as number,
        name: (exercise?.name as string) || "",
        skills: skillLinks.map((sl) => {
          const skill = sl.skills as Record<string, unknown>;
          return {
            id: sl.skill_id as number,
            name: (skill?.name as string) || "",
          };
        }),
      };
    }
  );

  // Get all unique skills for this session
  const allSkills = [
    ...new Map(
      exercises.flatMap((e) => e.skills).map((s) => [s.id, s])
    ).values(),
  ];

  const hasStudentInsight = !!session.student_insight;
  const hasTrainerNotes = !!session.trainer_notes;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href="/dashboard" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Занятие {session.session_number}
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-[430px] mx-auto space-y-6">
        {/* Session info */}
        <div>
          <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em] mb-1">
            {session.status === "completed" ? "Завершено" : "Запланировано"}
          </p>
          <h1 className="text-3xl font-black tracking-tighter">
            Занятие {session.session_number}
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {new Date(session.created_at).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Exercises */}
        <section className="bg-surface-card rounded-3xl p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4">
            Упражнения
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
                Упражнения пока не добавлены
              </p>
            )}
          </div>
        </section>

        {/* Skill gains summary */}
        {allSkills.length > 0 && (
          <section className="bg-surface-high rounded-3xl p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-3">
              Прокачка скилов
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

        {/* Insights */}
        <section className="space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Инсайты
          </p>

          {/* Student insight */}
          {!isTrainer && !hasStudentInsight && (
            <InsightForm
              sessionId={id}
              type="student"
              placeholder="Что ты вынес из этого занятия? Напиши свой инсайт..."
            />
          )}

          {hasStudentInsight && (
            <div className="bg-surface-card rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary mb-2">
                Мой инсайт
              </p>
              <p className="text-sm text-on-surface leading-relaxed">
                {session.student_insight}
              </p>
            </div>
          )}

          {/* Trainer notes */}
          {isTrainer && !hasTrainerNotes && (
            <InsightForm
              sessionId={id}
              type="trainer"
              placeholder="Заметки тренера: что получилось, над чем работать..."
            />
          )}

          {hasTrainerNotes && (hasStudentInsight || isTrainer) && (
            <div className="bg-surface-card rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                Заметки тренера
              </p>
              <p className="text-sm text-on-surface leading-relaxed">
                {session.trainer_notes}
              </p>
            </div>
          )}

          {hasTrainerNotes && !hasStudentInsight && !isTrainer && (
            <div className="bg-surface-card rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 backdrop-blur-md bg-surface-card/80 flex items-center justify-center z-10">
                <div className="text-center">
                  <span className="material-symbols-outlined text-primary text-3xl mb-2">
                    lock
                  </span>
                  <p className="text-on-surface-variant text-xs">
                    Напиши свой инсайт чтобы увидеть заметки тренера
                  </p>
                </div>
              </div>
              <p className="text-sm text-on-surface blur-sm">
                Заметки тренера будут доступны после написания инсайта
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
