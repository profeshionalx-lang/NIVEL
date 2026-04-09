import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calculateSkillLevel } from "@/lib/types";
import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Fetch active goals with problems
  const { data: goalsRaw } = await supabase
    .from("goals")
    .select(
      "*, goal_problems(problem_id, problems(id, name, problem_categories(name)))"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Count completed sessions per goal
  const goals = await Promise.all(
    (goalsRaw || []).map(async (goal: Record<string, unknown>) => {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("goal_id", goal.id as string);

      const goalProblems = (goal.goal_problems as Array<Record<string, unknown>>) || [];
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
        status: goal.status as string,
        created_at: goal.created_at as string,
        problems,
        completed_sessions: count || 0,
      };
    })
  );

  // Fetch skill progress
  const { data: skillProgressRaw } = await supabase
    .from("skill_progress")
    .select("*, skills(name)")
    .eq("user_id", user.id)
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

  // Fetch recent sessions
  const { data: sessionsRaw } = await supabase
    .from("sessions")
    .select("*, goals!inner(user_id)")
    .eq("goals.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const sessions = sessionsRaw || [];

  const firstName = profile.full_name?.split(" ")[0] || "Игрок";
  const isEmpty = goals.length === 0 && skillProgress.length === 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-on-surface-variant text-sm font-medium">
          Добро пожаловать,
        </p>
        <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
          {firstName}
        </h1>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">
            Nivel
          </h2>
          <p className="text-on-surface-variant text-center text-sm max-w-xs">
            Начни с создания первой цели — выбери проблемы над которыми хочешь
            работать
          </p>
          <Link
            href="/goals/new"
            className="kinetic-gradient text-on-primary font-black py-4 px-8 rounded-2xl text-lg active:scale-[0.98] transition-transform"
            style={{
              boxShadow:
                "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            Создать цель
          </Link>
        </div>
      ) : (
        <>
          {/* Active Goals */}
          <section>
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Активные цели
              </h3>
              <Link
                href="/goals/new"
                className="text-primary text-xs font-bold uppercase tracking-wider"
              >
                + Новая
              </Link>
            </div>
            <div
              className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5"
              style={{ scrollbarWidth: "none" }}
            >
              {goals.map((goal) => (
                  <div
                    key={goal.id}
                    className="flex-shrink-0 w-52 bg-surface-card rounded-2xl p-4"
                    style={{ borderTop: "2px solid #cafd00" }}
                  >
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="w-2 h-2 rounded-full bg-primary"
                        style={{ boxShadow: "0 0 6px #cafd00" }}
                      />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {goal.completed_sessions} занятий
                      </span>
                    </div>
                    {goal.problems.map((p) => (
                      <p
                        key={p.id}
                        className="text-sm font-semibold leading-snug text-on-surface mb-1"
                      >
                        {p.name.length > 50
                          ? p.name.slice(0, 50) + "..."
                          : p.name}
                      </p>
                    ))}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        ...new Set(goal.problems.map((p) => p.category_name)),
                      ].map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-high text-on-surface-variant"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Skill Progress */}
          {skillProgress.length > 0 && (
            <section className="bg-surface-high rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-5">
                Развитие скиллов
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

          {/* Session History */}
          {sessions.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-1">
                История сессий
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
                        {session.status === "completed" && " · Завершено"}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">
                      chevron_right
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
