// src/components/dashboard/DashboardView.tsx
import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
import { t, type Locale } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard/data";

import InlineGoalCreator from "@/components/dashboard/edit/InlineGoalCreator";
import InlineSessionCreator from "@/components/dashboard/edit/InlineSessionCreator";
import InlineProfileHeader from "@/components/dashboard/edit/InlineProfileHeader";
import MasterPlanEditor from "@/components/masterPlan/MasterPlanEditor";
import PlaytomicConnectBlock from "@/components/playtomic/PlaytomicConnectBlock";

export interface DashboardViewEditable {
  studentId: string;
  trainerId: string;
}

interface Props {
  data: DashboardData;
  locale: Locale;
  editable?: DashboardViewEditable | false;
}

export default function DashboardView({ data, locale, editable }: Props) {
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const { profile, goals, skillProgress, sessions, nextSession, masterPlan, totalPendingCards, firstPendingSessionId, upcomingMatches } = data;
  const isTrainer = !!editable;

  const displayName = profile.full_name || profile.email || "Unnamed";
  const firstName = profile.full_name?.split(" ")[0] || profile.email?.split("@")[0] || t(locale, "dashboard.player");
  const masterPlanPreview = masterPlan?.sections.slice(0, 2) ?? [];

  const planGoal =
    goals.find((g) => g.total_sessions > 0) ??
    goals.find((g) => g.session_count > 0) ??
    goals[0];
  const planPercent = planGoal && planGoal.session_count > 0
    ? Math.min(100, Math.round((planGoal.total_sessions / planGoal.session_count) * 100))
    : 0;

  const isEmpty = goals.length === 0 && skillProgress.length === 0 && !masterPlan && sessions.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      {isTrainer ? (
        <InlineProfileHeader profile={profile} />
      ) : (
        <div>
          <p className="text-on-surface-variant text-sm font-medium">{t(locale, "dashboard.welcome")}</p>
          <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
            {firstName} <span className="kinetic-text">👋</span>
          </h1>
        </div>
      )}

      {/* Playtomic connect block — student only */}
      {!isTrainer && (
        <PlaytomicConnectBlock currentUserId={profile.playtomic_user_id ?? null} />
      )}

      {/* Empty state — student only */}
      {isEmpty && !isTrainer ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">Nivel</h2>
          <p className="text-on-surface-variant text-center text-sm max-w-xs">
            {t(locale, "dashboard.emptyHint")}
          </p>
          <Link
            href="/goals/new"
            className="kinetic-gradient text-on-primary font-black py-4 px-8 rounded-2xl text-lg"
            style={{ boxShadow: "0 10px 30px rgba(202,253,0,0.25)" }}
          >
            {t(locale, "dashboard.createGoal")}
          </Link>
        </div>
      ) : (
        <>
          {/* Pending banner — student only */}
          {!isTrainer && totalPendingCards > 0 && firstPendingSessionId && (
            <Link
              href={`/sessions/${firstPendingSessionId}/insights`}
              className="block kinetic-gradient text-on-primary rounded-3xl p-5 glow-primary"
              style={{ boxShadow: "0 10px 30px rgba(202,253,0,0.35)" }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined fill-icon text-3xl">auto_awesome</span>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                    {t(locale, "common.actionRequired")}
                  </p>
                  <h2 className="text-xl font-black tracking-tight">
                    {totalPendingCards}{" "}
                    {totalPendingCards === 1
                      ? t(locale, "dashboard.insightsToReview.one")
                      : t(locale, "dashboard.insightsToReview")}
                  </h2>
                </div>
                <span className="material-symbols-outlined text-2xl">arrow_forward</span>
              </div>
            </Link>
          )}

          {/* Актуальное — student only */}
          {!isTrainer && (() => {
            // Build unified timeline: upcoming sessions + upcoming matches, sorted by date asc
            type TimelineItem =
              | { kind: "session"; id: string; session_number: number; scheduled_at: string | null; date: number }
              | { kind: "match"; id: string; start_date: string; location: string | null; resource_name: string | null; goalsCount: number; date: number };

            const now = Date.now();

            const sessionItems: TimelineItem[] = sessions
              .filter((s) => s.status === "planned")
              .map((s) => ({
                kind: "session" as const,
                id: s.id,
                session_number: s.session_number,
                scheduled_at: null,
                date: new Date(s.created_at).getTime(),
              }));

            // Also include nextSession if it has a scheduled_at
            const nextSessionItems: TimelineItem[] = nextSession?.scheduled_at
              ? [{
                  kind: "session" as const,
                  id: nextSession.id,
                  session_number: nextSession.session_number,
                  scheduled_at: nextSession.scheduled_at,
                  date: new Date(nextSession.scheduled_at).getTime(),
                }]
              : [];

            const matchItems: TimelineItem[] = (upcomingMatches ?? []).map((m) => ({
              kind: "match" as const,
              id: m.id,
              start_date: m.start_date,
              location: m.location,
              resource_name: m.resource_name,
              goalsCount: m.goalsCount,
              date: new Date(m.start_date).getTime(),
            }));

            // Merge: nextSession (has scheduled_at) + session items without duplicating nextSession + matches
            const sessionSet = new Set(sessionItems.map((s) => s.id));
            const uniqueNextSession = nextSessionItems.filter((ns) => !sessionSet.has(ns.id));

            const allItems = [...sessionItems, ...uniqueNextSession, ...matchItems]
              .filter((item) => item.date >= now - 60 * 60 * 1000) // at most 1hr past
              .sort((a, b) => a.date - b.date)
              .slice(0, 5);

            return (
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-3 px-1">
                  {t(locale, "dashboard.upcoming")}
                </h3>
                {allItems.length === 0 ? (
                  <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                    {t(locale, "dashboard.upcomingEmpty")}
                  </p>
                ) : (
                  <div className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {allItems.map((item) => {
                      if (item.kind === "session") {
                        const dateStr = item.scheduled_at
                          ? new Date(item.scheduled_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
                          : null;
                        return (
                          <Link
                            key={`session-${item.id}`}
                            href={`/sessions/${item.id}`}
                            className="snap-start shrink-0 w-[78%] flex flex-col gap-3 bg-surface-low rounded-2xl px-4 py-4 active:bg-surface-card transition-colors"
                          >
                            <div className="w-10 h-10 rounded-xl bg-surface-card text-primary flex items-center justify-center font-black text-sm">
                              {item.session_number}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm">
                                {t(locale, "dashboard.session")} {item.session_number}
                              </p>
                              {dateStr && (
                                <p className="text-[11px] text-on-surface-variant mt-0.5">{dateStr}</p>
                              )}
                            </div>
                          </Link>
                        );
                      }
                      // match
                      const dateStr = new Date(item.start_date).toLocaleDateString(dateLocale, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      return (
                        <Link
                          key={`match-${item.id}`}
                          href={`/matches/${item.id}`}
                          className="snap-start shrink-0 w-[78%] flex flex-col gap-3 bg-surface-low rounded-2xl px-4 py-4 active:bg-surface-card transition-colors"
                        >
                          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">sports_tennis</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">
                              {t(locale, "dashboard.upcomingMatch")}
                              {item.location ? ` · ${item.location}` : ""}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-0.5">
                              {dateStr}
                              {item.resource_name ? ` · ${item.resource_name}` : ""}
                            </p>
                            {item.goalsCount > 0 ? (
                              <p className="text-[10px] text-primary font-bold mt-1">
                                {item.goalsCount} {t(locale, "matches.goalsCount")}
                              </p>
                            ) : (
                              <p className="text-[10px] text-on-surface-variant mt-1">
                                {t(locale, "matches.setGoals")}
                              </p>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })()}

          {/* Master plan: trainer edits, student previews */}
          {isTrainer ? (
            <MasterPlanEditor studentId={editable.studentId} plan={masterPlan} />
          ) : masterPlan ? (
            <Link
              href="/masterplan"
              className="block bg-surface-low rounded-2xl p-4 active:bg-surface-card transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                  {t(locale, "dashboard.masterPlan")}
                </p>
                <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">chevron_right</span>
              </div>
              <div className="space-y-1.5">
                {masterPlanPreview.map((section) => (
                  <div key={section.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-60 flex-shrink-0" />
                    <p className="text-sm text-on-surface-variant truncate">{section.title}</p>
                    <span className="text-[10px] text-on-surface-variant opacity-40 flex-shrink-0">
                      {section.items.length} {t(locale, "common.items")}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          ) : null}

          {/* Plan progress — student only */}
          {!isTrainer && planGoal && planGoal.session_count > 0 && (
            <section className="bg-surface-low rounded-2xl p-4">
              <div className="flex justify-between items-baseline mb-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                    {t(locale, "dashboard.currentPlan")}
                  </p>
                  <span className="text-sm font-black tracking-tight">
                    {Math.min(planGoal.total_sessions, planGoal.session_count)}/{planGoal.session_count}
                  </span>
                </div>
                <span className="text-base font-black italic kinetic-text">{planPercent}%</span>
              </div>
            </section>
          )}

          {/* Goals */}
          <section>
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t(locale, "dashboard.activeGoals")}
              </h3>
              {isTrainer ? (
                <InlineGoalCreator studentId={editable.studentId} />
              ) : (
                <Link href="/goals/new" className="text-primary text-xs font-bold uppercase tracking-wider">
                  + {t(locale, "common.new")}
                </Link>
              )}
            </div>
            {goals.length === 0 ? (
              <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                {isTrainer ? "No goals yet. Click + new to add one." : "—"}
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
                {goals.map((goal) => (
                  <div key={goal.id} className="flex-shrink-0 w-52 bg-surface-card rounded-2xl p-4" style={{ borderTop: "2px solid #cafd00" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {goal.total_sessions}/{goal.session_count} {t(locale, "dashboard.sessions")}
                      </span>
                    </div>
                    {goal.problems.length > 0
                      ? goal.problems.map((p) => (
                          <p key={p.id} className="text-sm font-semibold leading-snug text-on-surface mb-1">
                            {p.name.length > 50 ? p.name.slice(0, 50) + "..." : p.name}
                          </p>
                        ))
                      : goal.custom_problem
                      ? <p className="text-sm font-semibold leading-snug text-on-surface mb-1">{goal.custom_problem}</p>
                      : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Skills */}
          {skillProgress.length > 0 && (
            <section className="bg-surface-high rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-5">
                {t(locale, "dashboard.skillProgression")}
              </h3>
              <div className="space-y-5">
                {skillProgress.map((sp, i) => (
                  <ProgressBar
                    key={sp.skill_id}
                    label={sp.skill_name}
                    value={sp.points_in_level}
                    max={10}
                    variant={i % 2 === 0 ? "secondary" : "primary"}
                    sublabel={`${sp.points_in_level}/10 · Lv.${sp.level}`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sessions list */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t(locale, "dashboard.sessionHistory")}
              </h3>
              {isTrainer && (
                <InlineSessionCreator studentId={editable.studentId} goals={goals} />
              )}
            </div>
            {sessions.length === 0 ? (
              <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                {isTrainer ? "No sessions yet. Add a goal first, then create your first session." : "—"}
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-2">
                    <Link
                      href={`/sessions/${session.id}`}
                      className={`flex-1 flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
                        session.pending > 0
                          ? "bg-primary/10 border border-primary/40 glow-primary"
                          : "bg-surface-low active:bg-surface-card"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        session.pending > 0 ? "kinetic-gradient text-on-primary" : "bg-surface-card text-primary"
                      }`}>
                        {session.session_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {(() => {
                            const d = new Date(session.created_at);
                            const weekday = new Intl.DateTimeFormat(dateLocale, { weekday: "long" }).format(d);
                            const time = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
                            return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${time}`;
                          })()}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(session.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long" })}
                          {session.status === "completed" && ` · ${t(locale, "common.completed")}`}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">chevron_right</span>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Next session — student only */}
          {!isTrainer && nextSession && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-1">
                {t(locale, "dashboard.nextSession")}
              </h3>
              <Link href={`/sessions/${nextSession.id}`} className="block bg-surface-low rounded-3xl p-5">
                <h4 className="text-xl font-black tracking-tight mb-4">
                  {t(locale, "dashboard.session")} {nextSession.session_number}
                </h4>
              </Link>
            </section>
          )}

          {/* Helpful hint — silence the linter about unused displayName */}
          {isTrainer && <span className="hidden">{displayName}</span>}
        </>
      )}
    </div>
  );
}
