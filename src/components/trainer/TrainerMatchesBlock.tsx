// src/components/trainer/TrainerMatchesBlock.tsx
// Read-only overview of a student's matches for the trainer view.
// Shows upcoming and past matches with attached insights and reflection.
// No edit controls — trainer can observe only.

import { createClient } from "@/lib/supabase/server";
import { t, type Locale } from "@/lib/i18n/dict";

const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];

interface Player {
  name?: string;
  level?: number;
  [key: string]: unknown;
}

interface Team {
  players?: Player[];
  [key: string]: unknown;
}

interface MatchWithInsights {
  id: string;
  start_date: string;
  location: string | null;
  resource_name: string | null;
  status: string | null;
  teams: unknown;
  reflection: string | null;
  attachedInsights: Array<{
    id: string;
    front_text: string;
    problem_name: string | null;
  }>;
}

function formatDate(iso: string, locale: Locale): string {
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  return new Date(iso).toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractPlayers(teams: unknown): Player[] {
  if (!Array.isArray(teams)) return [];
  const players: Player[] = [];
  for (const team of teams as Team[]) {
    if (Array.isArray(team.players)) {
      for (const p of team.players as Player[]) {
        players.push(p);
      }
    }
  }
  return players.slice(0, 4);
}

async function fetchStudentMatches(
  studentId: string
): Promise<{ upcoming: MatchWithInsights[]; past: MatchWithInsights[] }> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("matches")
    .select(
      `
      id,
      start_date,
      location,
      resource_name,
      status,
      teams,
      reflection,
      match_goals(insight_id)
    `
    )
    .eq("profile_id", studentId)
    .order("start_date", { ascending: false })
    .limit(30);

  if (!rows || rows.length === 0) {
    return { upcoming: [], past: [] };
  }

  const allInsightIds = (
    rows as Array<{ match_goals: Array<{ insight_id: string }> }>
  ).flatMap((r) => r.match_goals.map((g) => g.insight_id));

  const insightMap = new Map<
    string,
    { id: string; front_text: string; problem_name: string | null }
  >();

  if (allInsightIds.length > 0) {
    const { data: insightRows } = await supabase
      .from("insight_cards")
      .select("id, front_text, problem:problems(id, name)")
      .in("id", allInsightIds);

    for (const r of insightRows ?? []) {
      const prob = r.problem as unknown;
      const probNorm = Array.isArray(prob) ? prob[0] : prob;
      const problemName =
        probNorm != null && typeof probNorm === "object"
          ? (probNorm as { name: string }).name
          : null;
      insightMap.set(r.id, {
        id: r.id,
        front_text: r.front_text,
        problem_name: problemName,
      });
    }
  }

  const matches: MatchWithInsights[] = (
    rows as Array<{
      id: string;
      start_date: string;
      location: string | null;
      resource_name: string | null;
      status: string | null;
      teams: unknown;
      reflection: string | null;
      match_goals: Array<{ insight_id: string }>;
    }>
  ).map((r) => ({
    id: r.id,
    start_date: r.start_date,
    location: r.location,
    resource_name: r.resource_name,
    status: r.status,
    teams: r.teams,
    reflection: r.reflection,
    attachedInsights: r.match_goals
      .map((g) => insightMap.get(g.insight_id))
      .filter((x): x is NonNullable<typeof x> => x != null),
  }));

  const upcoming = matches
    .filter((m) => UPCOMING_STATUSES.includes(m.status ?? ""))
    .sort(
      (a, b) =>
        new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

  const past = matches
    .filter((m) => !UPCOMING_STATUSES.includes(m.status ?? ""))
    .sort(
      (a, b) =>
        new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );

  return { upcoming, past };
}

function MatchRowCard({
  match,
  locale,
}: {
  match: MatchWithInsights;
  locale: Locale;
}) {
  const isUpcoming = UPCOMING_STATUSES.includes(match.status ?? "");
  const players = extractPlayers(match.teams);

  return (
    <div className="bg-surface-card rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-on-surface">
            {formatDate(match.start_date, locale)}
          </p>
          {match.location && (
            <p className="text-xs text-on-surface-variant">{match.location}</p>
          )}
          {match.resource_name && (
            <p className="text-xs text-on-surface-variant">
              {match.resource_name}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 ${
            isUpcoming
              ? "bg-primary/15 text-primary"
              : "bg-surface-elevated text-on-surface-variant"
          }`}
        >
          {match.status ?? "—"}
        </span>
      </div>

      {players.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {players.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-surface-elevated rounded-xl px-2.5 py-1.5"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                person
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-on-surface truncate">
                  {p.name ?? "—"}
                </p>
                {p.level != null && (
                  <p className="text-[10px] text-on-surface-variant">
                    {Number(p.level).toFixed(1)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {match.attachedInsights.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant">
            {t(locale, "matches.detail.goals")}
          </p>
          {match.attachedInsights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-start gap-2 bg-surface-elevated rounded-xl px-3 py-2"
            >
              <span className="material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0">
                flag
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-on-surface leading-snug">
                  {insight.front_text}
                </p>
                {insight.problem_name && (
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {insight.problem_name}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isUpcoming && match.reflection && (
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant">
            {t(locale, "matches.detail.reflection")}
          </p>
          <p className="text-xs text-on-surface leading-relaxed bg-surface-elevated rounded-xl px-3 py-2">
            {match.reflection}
          </p>
        </div>
      )}
    </div>
  );
}

interface Props {
  studentId: string;
  locale: Locale;
}

export default async function TrainerMatchesBlock({ studentId, locale }: Props) {
  const { upcoming, past } = await fetchStudentMatches(studentId);

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <section>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-3 px-1">
          {t(locale, "matches.title")}
        </h3>
        <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
          {t(locale, "trainer.matches.empty")}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant px-1">
        {t(locale, "matches.title")}
      </h3>

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary px-1">
            {t(locale, "matches.tabUpcoming")}
          </p>
          {upcoming.map((match) => (
            <MatchRowCard key={match.id} match={match} locale={locale} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant px-1">
            {t(locale, "matches.tabPast")}
          </p>
          {past.map((match) => (
            <MatchRowCard key={match.id} match={match} locale={locale} />
          ))}
        </div>
      )}
    </section>
  );
}
