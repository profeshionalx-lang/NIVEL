import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { calculateSkillLevel } from "@/lib/types";
import Link from "next/link";
import SkillWeb from "@/components/ui/SkillWeb";

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

  const { data: goalsRaw } = await supabase
    .from("goals")
    .select(
      "*, goal_problems(problem_id, problems(id, name, problem_categories(name)))"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

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

      const completedCount = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("goal_id", goal.id as string)
        .eq("status", "completed");

      return {
        id: goal.id as string,
        custom_problem: (goal.custom_problem as string) || null,
        status: goal.status as string,
        session_count: (goal.session_count as number) ?? 0,
        created_at: goal.created_at as string,
        problems,
        total_sessions: count || 0,
        completed_sessions: completedCount.count || 0,
      };
    })
  );

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

  const { data: sessionsRaw } = await supabase
    .from("sessions")
    .select("*, goals!inner(user_id)")
    .eq("goals.user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const sessions = (sessionsRaw ?? []) as Array<Record<string, unknown>>;

  const { data: nextSessionRaw } = await supabase
    .from("sessions")
    .select(
      "*, goals!inner(user_id), session_exercises(id, exercises(name))"
    )
    .eq("goals.user_id", user.id)
    .eq("status", "planned")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextSession = nextSessionRaw as Record<string, unknown> | null;
  const nextExercises = nextSession
    ? ((nextSession.session_exercises as Array<Record<string, unknown>>) || [])
        .map((se) => (se.exercises as Record<string, unknown>)?.name as string)
        .filter(Boolean)
    : [];

  const { data: pendingByCard } = await supabase
    .from("insight_cards")
    .select("session_id")
    .eq("student_id", user.id)
    .eq("trainer_status", "approved")
    .is("student_decision", null);

  const pendingCounts = new Map<string, number>();
  (pendingByCard ?? []).forEach((row) => {
    const sid = row.session_id as string;
    pendingCounts.set(sid, (pendingCounts.get(sid) ?? 0) + 1);
  });

  const firstName = profile.full_name?.split(" ")[0] || "Player";
  const isEmpty = goals.length === 0 && skillProgress.length === 0;

  const planGoal =
    goals.find((g) => g.total_sessions > 0) ??
    goals.find((g) => g.session_count > 0) ??
    goals[0];
  const planPercent = planGoal && planGoal.session_count > 0
    ? Math.min(100, Math.round((planGoal.total_sessions / planGoal.session_count) * 100))
    : 0;

  const pendingSessionsList = sessions
    .filter((s) => (pendingCounts.get(s.id as string) ?? 0) > 0)
    .map((s) => ({
      id: s.id as string,
      session_number: s.session_number as number,
      pending: pendingCounts.get(s.id as string) ?? 0,
    }));
  const totalPendingCards = pendingSessionsList.reduce((sum, s) => sum + s.pending, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-on-surface-variant text-sm font-medium">Welcome,</p>
        <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
          {firstName} <span className="kinetic-text">👋</span>
        </h1>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">
            Nivel
          </h2>
          <p className="text-on-surface-variant text-center text-sm max-w-xs">
            Start by creating your first goal — pick the problems you want to
            work on.
          </p>
          <Link
            href="/goals/new"
            className="kinetic-gradient text-on-primary font-black py-4 px-8 rounded-2xl text-lg active:scale-[0.98] transition-transform"
            style={{
              boxShadow:
                "0 10px 30px rgba(202,253,0,0.25), 0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            Create goal
          </Link>
        </div>
      ) : (
        <>
          {totalPendingCards > 0 && (
            <Link
              href={`/sessions/${pendingSessionsList[0].id}/insights`}
              className="block kinetic-gradient text-on-primary rounded-3xl p-5 glow-primary active:scale-[0.98] transition-transform"
              style={{
                boxShadow:
                  "0 10px 30px rgba(202,253,0,0.35), 0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined fill-icon text-3xl">
                  auto_awesome
                </span>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                    Action required
                  </p>
                  <h2 className="text-xl font-black tracking-tight">
                    {totalPendingCards} new{" "}
                    {totalPendingCards === 1 ? "insight" : "insights"} to review
                  </h2>
                  <p className="text-xs opacity-80 mt-0.5">
                    From session {pendingSessionsList[0].session_number}
                    {pendingSessionsList.length > 1 &&
                      ` and ${pendingSessionsList.length - 1} more`}
                  </p>
                </div>
                <span className="material-symbols-outlined text-2xl">
                  arrow_forward
                </span>
              </div>
            </Link>
          )}

          {planGoal && planGoal.session_count > 0 && (
            <section className="bg-surface-low rounded-2xl p-4">
              <div className="flex justify-between items-baseline mb-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                    Current plan
                  </p>
                  <span className="text-sm font-black tracking-tight">
                    {Math.min(planGoal.total_sessions, planGoal.session_count)}/{planGoal.session_count}
                  </span>
                </div>
                <span className="text-base font-black italic kinetic-text">
                  {planPercent}%
                </span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: planGoal.session_count }).map((_, i) => {
                  const done = i < planGoal.total_sessions;
                  const current = i === planGoal.total_sessions;
                  return (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full ${
                        done
                          ? "bg-primary"
                          : current
                          ? "bg-primary glow-primary"
                          : "bg-surface-elevated"
                      }`}
                    />
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                Active goals
              </h3>
              <Link
                href="/goals/new"
                className="text-primary text-xs font-bold uppercase tracking-wider"
              >
                + New
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
                      {goal.total_sessions}/{goal.session_count} sessions
                    </span>
                  </div>
                  {goal.problems.length > 0 ? (
                    <>
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
                    </>
                  ) : goal.custom_problem ? (
                    <p className="text-sm font-semibold leading-snug text-on-surface mb-1">
                      {goal.custom_problem.length > 50
                        ? goal.custom_problem.slice(0, 50) + "..."
                        : goal.custom_problem}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {(() => {
            const WEB_ORDER = [
              "Overheads",
              "Positioning",
              "Footwork",
              "Communication",
              "Decision-making",
              "Tactics",
              "Glass play",
              "Defence",
            ];
            const map = new Map(
              skillProgress.map((sp) => [sp.skill_name, sp.points])
            );
            const slices = WEB_ORDER.map((label) => ({
              label,
              value: map.get(label) ?? 0,
            }));
            const hasAny = slices.some((s) => s.value > 0);
            if (!hasAny) return null;
            return (
              <section className="bg-surface-high rounded-3xl p-6">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-2">
                  Skill web
                </h3>
                <SkillWeb slices={slices} max={10} />
              </section>
            );
          })()}

          {sessions.length > 0 && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-1">
                Session history
              </h3>
              <div className="space-y-2">
                {sessions.map((session) => {
                  const sid = session.id as string;
                  const pending = pendingCounts.get(sid) ?? 0;
                  return (
                    <Link
                      key={sid}
                      href={`/sessions/${sid}`}
                      className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
                        pending > 0
                          ? "bg-primary/10 border border-primary/40 glow-primary"
                          : "bg-surface-low active:bg-surface-card"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                          pending > 0
                            ? "kinetic-gradient text-on-primary"
                            : "bg-surface-card text-primary"
                        }`}
                      >
                        {session.session_number as number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          Session {session.session_number as number}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(
                            session.created_at as string
                          ).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "long",
                          })}
                          {session.status === "completed" && " · Completed"}
                        </p>
                      </div>
                      {pending > 0 ? (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-on-primary kinetic-gradient px-2.5 py-1 rounded-full">
                          <span
                            className="material-symbols-outlined text-sm fill-icon"
                            style={{ fontSize: "14px" }}
                          >
                            auto_awesome
                          </span>
                          {pending} new
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">
                          chevron_right
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {nextSession && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-1">
                Next session
              </h3>
              <Link
                href={`/sessions/${nextSession.id as string}`}
                className="block bg-surface-low rounded-3xl p-5 relative overflow-hidden active:scale-[0.98] transition-transform"
              >
                <div
                  className="absolute top-0 right-0 w-40 h-40 opacity-[0.04] pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, #00f4fe, transparent)",
                  }}
                />
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-2 h-2 rounded-full bg-secondary animate-pulse"
                    style={{ boxShadow: "0 0 6px #00f4fe" }}
                  />
                  <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                    {nextSession.scheduled_at
                      ? new Date(nextSession.scheduled_at as string).toLocaleString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Upcoming"}
                  </p>
                </div>
                <h4 className="text-xl font-black tracking-tight mb-4">
                  Session {nextSession.session_number as number}
                </h4>
                {nextExercises.length > 0 && (
                  <div className="bg-surface-card rounded-2xl p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-2">
                      Exercises
                    </p>
                    {nextExercises.slice(0, 3).map((ex, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 text-sm text-on-surface-variant"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-60" />
                        {ex}
                      </div>
                    ))}
                    {nextExercises.length > 3 && (
                      <p className="text-xs text-on-surface-variant opacity-50 pl-4">
                        + {nextExercises.length - 3} more
                      </p>
                    )}
                  </div>
                )}
              </Link>
            </section>
          )}
        </>
      )}
    </div>
  );
}
