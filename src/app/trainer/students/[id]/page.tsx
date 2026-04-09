import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { calculateSkillLevel } from "@/lib/types";
import ProgressBar from "@/components/ui/ProgressBar";

export default async function TrainerStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studentId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verify trainer
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (myProfile?.role !== "trainer") redirect("/dashboard");

  // Get student profile
  const { data: student } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", studentId)
    .single();

  if (!student) redirect("/trainer/students");

  // Get student goals with problems
  const { data: goalsRaw } = await supabase
    .from("goals")
    .select(
      "*, goal_problems(problem_id, problems(id, name, problem_categories(name)))"
    )
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  const goals = await Promise.all(
    (goalsRaw || []).map(async (goal: Record<string, unknown>) => {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("goal_id", goal.id as string);

      const goalProblems =
        (goal.goal_problems as Array<Record<string, unknown>>) || [];
      const problems = goalProblems.map((gp) => {
        const prob = gp.problems as Record<string, unknown>;
        const cat = prob?.problem_categories as Record<string, unknown>;
        return {
          id: prob?.id as number,
          name: prob?.name as string,
          category_name: (cat?.name as string) || "",
        };
      });

      return {
        id: goal.id as string,
        custom_problem: (goal.custom_problem as string) || null,
        status: goal.status as string,
        problems,
        completed_sessions: count || 0,
      };
    })
  );

  const activeGoals = goals.filter((g) => g.status === "active");

  // Get skill progress
  const { data: skillProgressRaw } = await supabase
    .from("skill_progress")
    .select("*, skills(name)")
    .eq("user_id", studentId)
    .order("points", { ascending: false });

  const skillProgress = (skillProgressRaw || []).map(
    (sp: Record<string, unknown>) => {
      const skill = sp.skills as Record<string, unknown>;
      const points = sp.points as number;
      const { level, points_in_level } = calculateSkillLevel(points);
      return {
        skill_id: sp.skill_id as number,
        skill_name: (skill?.name as string) || "",
        points,
        level,
        points_in_level,
      };
    }
  );

  // Get recent sessions
  const { data: sessionsRaw } = await supabase
    .from("sessions")
    .select("*, goals!inner(user_id)")
    .eq("goals.user_id", studentId)
    .order("created_at", { ascending: false })
    .limit(20);

  const sessions = sessionsRaw || [];

  const studentName = student.full_name || student.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href="/trainer/students" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Ученик
        </span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto space-y-6">
        {/* Student info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-surface-card border-2 border-primary flex items-center justify-center">
            {student.avatar_url ? (
              <img
                src={student.avatar_url}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-bold text-on-surface">
                {studentName
                  .split(" ")
                  .map((w: string) => w[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{studentName}</h1>
            <p className="text-on-surface-variant text-sm">{student.email}</p>
          </div>
        </div>

        {/* Active Goals */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
            Активные цели
          </h3>
          {activeGoals.length === 0 ? (
            <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
              Нет активных целей
            </p>
          ) : (
            <div className="space-y-3">
              {activeGoals.map((goal) => (
                <div
                  key={goal.id}
                  className="bg-surface-card rounded-2xl p-4"
                  style={{ borderTop: "2px solid #cafd00" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                      {goal.completed_sessions} занятий
                    </span>
                    <Link
                      href={`/trainer/sessions/new?goalId=${goal.id}&studentId=${studentId}`}
                      className="text-secondary text-xs font-bold uppercase tracking-wider"
                    >
                      + Занятие
                    </Link>
                  </div>
                  {goal.problems.length > 0 ? (
                    goal.problems.map((p) => (
                      <p
                        key={p.id}
                        className="text-sm font-semibold leading-snug text-on-surface mb-1"
                      >
                        {p.name}
                      </p>
                    ))
                  ) : goal.custom_problem ? (
                    <p className="text-sm font-semibold leading-snug text-on-surface mb-1">
                      {goal.custom_problem}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Skills */}
        {skillProgress.length > 0 && (
          <section className="bg-surface-high rounded-3xl p-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-5">
              Скилы
            </h3>
            <div className="space-y-5">
              {skillProgress.map((sp, i) => (
                <ProgressBar
                  key={sp.skill_id}
                  label={sp.skill_name}
                  value={sp.points_in_level}
                  max={10}
                  variant={i % 2 === 0 ? "secondary" : "primary"}
                  sublabel={`${sp.points_in_level}/10 · Ур.${sp.level}`}
                />
              ))}
            </div>
          </section>
        )}

        {/* Sessions */}
        {sessions.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
              История занятий
            </h3>
            <div className="space-y-2">
              {sessions.map((session: Record<string, unknown>) => (
                <Link
                  key={session.id as string}
                  href={`/sessions/${session.id}`}
                  className="flex items-center gap-4 bg-surface-low rounded-2xl px-4 py-3.5 active:bg-surface-card transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center font-black text-primary text-sm flex-shrink-0">
                    {session.session_number as number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      Занятие {session.session_number as number}
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                      {new Date(
                        session.created_at as string
                      ).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                      })}
                      {!session.trainer_notes && (
                        <span className="text-error ml-2">Нужны заметки</span>
                      )}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant opacity-40">
                    chevron_right
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
