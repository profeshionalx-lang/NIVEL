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
import SkillProgressSection from "@/components/dashboard/SkillProgressSection";
import MarkSeenEffect from "@/components/dashboard/MarkSeenEffect";
import InlineSkillAdder from "@/components/dashboard/edit/InlineSkillAdder";
import TelegramLinkCard from "@/components/telegram/TelegramLinkCard";
import SubscriptionCard from "@/components/dashboard/SubscriptionCard";

export interface DashboardViewEditable {
  studentId: string;
  trainerId: string;
}

interface Props {
  data: DashboardData;
  locale: Locale;
  editable?: DashboardViewEditable | false;
  previewMode?: boolean;
  allSkills?: { id: number; name: string }[];
}

function pluralizeInsights(locale: Locale, n: number): string {
  if (locale === "ru") {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return t(locale, "dashboard.insightsToReview");
    if (mod10 === 1) return t(locale, "dashboard.insightsToReview.one");
    if (mod10 >= 2 && mod10 <= 4) return t(locale, "dashboard.insightsToReview.few");
    return t(locale, "dashboard.insightsToReview");
  }
  return n === 1
    ? t(locale, "dashboard.insightsToReview.one")
    : t(locale, "dashboard.insightsToReview");
}

export default function DashboardView({ data, locale, editable, previewMode, allSkills }: Props) {
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const { profile, goals, skillProgress, sessions, nextSession, masterPlan, totalPendingCards, firstPendingSessionId, upcomingMatches, subscription } = data;
  const isTrainer = !!editable && !previewMode;
  const sessionLinkSuffix = previewMode ? "?as=student" : "";

  const displayName = profile.full_name || profile.email || "Unnamed";
  const firstName = profile.full_name?.split(" ")[0] || profile.email?.split("@")[0] || t(locale, "dashboard.player");
  const masterPlanPreview = masterPlan?.sections.slice(0, 2) ?? [];

  const isEmpty = goals.length === 0 && skillProgress.length === 0 && !masterPlan && sessions.length === 0;

  return (
    <div className="space-y-6">
      {/* Mark dashboard data as seen — real student viewing their own dashboard only */}
      {!isTrainer && !previewMode && <MarkSeenEffect userId={profile.id} />}

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

      {/* Playtomic connect block — student only (skip in trainer preview to avoid mutating trainer's account) */}
      {!isTrainer && !previewMode && (
        <PlaytomicConnectBlock currentUserId={profile.playtomic_user_id ?? null} />
      )}

      {/* Telegram link — student only */}
      {!isTrainer && !previewMode && <TelegramLinkCard />}

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
              href={`/sessions/${firstPendingSessionId}/insights?from=dashboard${sessionLinkSuffix ? `&as=student` : ""}`}
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
                    {pluralizeInsights(locale, totalPendingCards)}
                  </h2>
                </div>
                <span className="material-symbols-outlined text-2xl">arrow_forward</span>
              </div>
            </Link>
          )}

          {/* Абонемент: остаток тренировок по паку */}
          {subscription && (
            <SubscriptionCard subscription={subscription} locale={locale} />
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
                scheduled_at: s.scheduled_at,
                date: new Date(s.scheduled_at ?? s.created_at).getTime(),
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

            if (allItems.length === 0) return null;

            return (
              <section>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-3 px-1">
                  {t(locale, "dashboard.upcoming")}
                </h3>
                <div className="-mx-4 px-4 flex gap-2 overflow-x-auto snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {allItems.map((item) => {
                      if (item.kind === "session") {
                        const dateStr = item.scheduled_at
                          ? new Date(item.scheduled_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })
                          : null;
                        return (
                          <Link
                            key={`session-${item.id}`}
                            href={`/sessions/${item.id}${sessionLinkSuffix}`}
                            className="snap-start shrink-0 w-[60%] flex flex-col gap-1.5 bg-surface-low rounded-2xl px-3.5 py-3 active:bg-surface-card transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-xs">
                                {t(locale, "dashboard.session")}{item.session_number}
                              </p>
                              {dateStr && (
                                <p className="text-[10px] text-on-surface-variant mt-0.5">{dateStr}</p>
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
                          className="snap-start shrink-0 w-[60%] flex flex-col gap-1.5 bg-surface-low rounded-2xl px-3.5 py-3 active:bg-surface-card transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">
                              {t(locale, "dashboard.upcomingMatch")}
                              {item.location ? ` · ${item.location}` : ""}
                            </p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">
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
                {goals.map((goal) => {
                  const isNewGoal = goal.is_new;
                  return (
                    <div key={goal.id} className="flex-shrink-0 w-52 bg-surface-card rounded-2xl p-4" style={{ borderTop: "2px solid #cafd00" }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                          {t(locale, "dashboard.goal")}
                        </span>
                        {isNewGoal && (
                          <span
                            className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-widest leading-none"
                            style={{ backgroundColor: "#cafd00", color: "#0a0a0a" }}
                          >
                            NEW
                          </span>
                        )}
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
                  );
                })}
              </div>
            )}
          </section>

          {/* Skills */}
          {(skillProgress.length > 0 || (isTrainer && editable)) && (() => {
            const deltas: Record<number, number> = {};
            const newIds: number[] = [];
            for (const sp of skillProgress) {
              if (sp.points_seen === null) {
                newIds.push(sp.skill_id);
                if (sp.points > 0) deltas[sp.skill_id] = sp.points;
              } else {
                const delta = Math.max(0, sp.points - sp.points_seen);
                if (delta > 0) deltas[sp.skill_id] = delta;
              }
            }
            return (
              <SkillProgressSection
                skills={skillProgress}
                deltas={deltas}
                newIds={newIds}
                label={t(locale, "dashboard.skillProgression")}
                addButton={isTrainer && editable && allSkills ? (
                  <InlineSkillAdder
                    studentId={editable.studentId}
                    allSkills={allSkills}
                    existingSkills={skillProgress.map((sp) => ({ skill_id: sp.skill_id, points: sp.points }))}
                  />
                ) : undefined}
              />
            );
          })()}

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
            {sessions.filter((s) => s.status === "completed").length === 0 ? (
              <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                {isTrainer ? "No sessions yet. Add a goal first, then create your first session." : "—"}
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.filter((s) => s.status === "completed").map((session) => (
                  <div key={session.id} className="flex items-center gap-2">
                    <Link
                      href={`/sessions/${session.id}${sessionLinkSuffix}`}
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
                            const d = new Date(session.scheduled_at ?? session.created_at);
                            const weekday = new Intl.DateTimeFormat(dateLocale, { weekday: "long", timeZone: "Europe/Madrid" }).format(d);
                            const time = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Madrid" }).format(d);
                            return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${time}`;
                          })()}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(session.scheduled_at ?? session.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long", timeZone: "Europe/Madrid" })}
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

          {/* Helpful hint — silence the linter about unused displayName */}
          {isTrainer && <span className="hidden">{displayName}</span>}
        </>
      )}
    </div>
  );
}
