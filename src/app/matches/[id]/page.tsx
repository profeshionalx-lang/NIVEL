import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n";
import { t } from "@/lib/i18n/dict";
import AttachInsightModal from "@/components/matches/AttachInsightModal";
import ReflectionTextarea from "@/components/matches/ReflectionTextarea";
import { getVaultCards } from "@/lib/actions/insightCards";

const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];

interface Player {
  name?: string;
  level?: number;
  playtomic_user_id?: string;
  [key: string]: unknown;
}

interface Team {
  players?: Player[];
  [key: string]: unknown;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractTeams(raw: unknown): Team[] {
  if (!Array.isArray(raw)) return [];
  return raw as Team[];
}

/**
 * Parses the Playtomic `results` jsonb into a human-readable score string.
 * Playtomic results can be an array of game objects like:
 *   [{ sets: [{local_score: 6, visitor_score: 3}, ...] }]
 * or a flat array of score objects.
 * Returns a formatted string like "6-3, 4-6, 6-4", or null if not parseable.
 */
function formatScore(results: unknown): string | null {
  if (results == null || typeof results !== "object") return null;
  if (!Array.isArray(results)) return null;

  const sets: string[] = [];

  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;

    // Shape: { sets: [{local_score, visitor_score}] }
    if (Array.isArray(obj["sets"])) {
      for (const s of obj["sets"] as unknown[]) {
        if (!s || typeof s !== "object") continue;
        const setObj = s as Record<string, unknown>;
        const local =
          setObj["local_score"] ?? setObj["team1"] ?? setObj["home"];
        const visitor =
          setObj["visitor_score"] ?? setObj["team2"] ?? setObj["away"];
        if (local != null && visitor != null) {
          sets.push(`${local}-${visitor}`);
        }
      }
    } else {
      // Flat shape: [{local_score, visitor_score}]
      const local = obj["local_score"] ?? obj["team1"] ?? obj["home"];
      const visitor = obj["visitor_score"] ?? obj["team2"] ?? obj["away"];
      if (local != null && visitor != null) {
        sets.push(`${local}-${visitor}`);
      }
    }
  }

  return sets.length > 0 ? sets.join(", ") : null;
}

export default async function MatchDetailPage({ params }: PageProps) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;
  const locale = await getLocale();
  const supabase = await createClient();

  // Fetch match with attached insight ids and reflection
  const { data: matchRaw, error } = await supabase
    .from("matches")
    .select(
      `
      id,
      start_date,
      end_date,
      location,
      resource_name,
      status,
      teams,
      results,
      reflection,
      match_goals(insight_id)
    `
    )
    .eq("id", id)
    .eq("profile_id", user.id)
    .single();

  if (error || !matchRaw) notFound();

  const match = matchRaw as {
    id: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
    resource_name: string | null;
    status: string | null;
    teams: unknown;
    results: unknown;
    reflection: string | null;
    match_goals: Array<{ insight_id: string }>;
  };

  const attachedIds = match.match_goals.map((g) => g.insight_id);
  const isUpcoming = UPCOMING_STATUSES.includes(match.status ?? "");
  const isPlayed = match.status === "PLAYED";
  const scoreText = isPlayed ? formatScore(match.results) : null;

  // Fetch profile for playtomic_user_id to highlight "me"
  const { data: profile } = await supabase
    .from("profiles")
    .select("playtomic_user_id")
    .eq("id", user.id)
    .single();

  const myPlaytomicId = (
    profile as { playtomic_user_id: string | null } | null
  )?.playtomic_user_id;

  const teams = extractTeams(match.teams);

  // Fetch insight vault (taken cards only) for the attach modal
  const vaultCards = await getVaultCards();
  const insightOptions = vaultCards.map((c) => ({
    id: c.id,
    front_text: c.front_text,
    problem: c.problem,
  }));

  // Fetch full insight data for attached ones to display in the list
  let attachedInsights: Array<{
    id: string;
    front_text: string;
    title: string | null;
    problem: { name: string } | null;
  }> = [];

  if (attachedIds.length > 0) {
    const { data: insightRows } = await supabase
      .from("insight_cards")
      .select("id, front_text, title, problem:problems(id, name)")
      .in("id", attachedIds);

    attachedInsights = (insightRows ?? []).map((r) => {
      const prob = r.problem as unknown;
      const probNormalized = Array.isArray(prob) ? prob[0] : prob;
      const problemObj =
        probNormalized != null && typeof probNormalized === "object"
          ? (probNormalized as { name: string })
          : null;
      return {
        id: r.id,
        front_text: r.front_text,
        title: (r.title as string | null) ?? null,
        problem: problemObj,
      };
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-nav h-16 flex items-center gap-3 px-4">
        <Link
          href="/matches"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-elevated hover:bg-border-dim transition-colors"
        >
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            arrow_back
          </span>
        </Link>
        <span className="text-base font-black text-primary uppercase italic tracking-tight">
          {match.location ?? t(locale, "matches.title")}
        </span>
        <span
          className={`ml-auto text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
            isUpcoming
              ? "bg-primary/15 text-primary"
              : "bg-surface-elevated text-on-surface-variant"
          }`}
        >
          {match.status ?? "—"}
        </span>
      </header>

      <main className="px-4 pt-4 pb-36 space-y-5">
        {/* Date & Court */}
        <section className="bg-surface-card rounded-2xl p-4 space-y-1">
          <p className="text-sm font-bold text-on-surface capitalize">
            {formatDate(match.start_date)}
          </p>
          {match.location && (
            <p className="text-xs text-on-surface-variant">{match.location}</p>
          )}
          {match.resource_name && (
            <p className="text-xs text-on-surface-variant">
              {t(locale, "matches.detail.court")}: {match.resource_name}
            </p>
          )}
        </section>

        {/* Teams */}
        {teams.length > 0 && (
          <section className="space-y-2">
            {teams.map((team, teamIdx) => (
              <div key={teamIdx} className="bg-surface-card rounded-2xl p-4 space-y-2">
                {(team.players ?? []).map((player, playerIdx) => {
                  const isMe =
                    myPlaytomicId != null &&
                    player.playtomic_user_id === myPlaytomicId;
                  return (
                    <div
                      key={playerIdx}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
                        isMe
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-surface-elevated"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          isMe ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {isMe ? "person_check" : "person"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isMe ? "text-primary" : "text-on-surface"
                          }`}
                        >
                          {player.name ?? "—"}
                        </p>
                        {player.level != null && (
                          <p className="text-[10px] text-on-surface-variant">
                            {Number(player.level).toFixed(1)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        )}

        {/* Goals block — only for upcoming matches */}
        {isUpcoming && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-widest text-on-surface">
                {t(locale, "matches.detail.goals")}
              </p>
              <AttachInsightModal
                matchId={match.id}
                locale={locale}
                allInsights={insightOptions}
                attachedIds={attachedIds}
              />
            </div>

            {attachedInsights.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center bg-surface-card rounded-2xl">
                <span className="material-symbols-outlined text-3xl text-on-surface-variant">
                  flag
                </span>
                <p className="text-sm text-on-surface-variant">
                  {t(locale, "matches.detail.noGoals")}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {attachedInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="bg-surface-card rounded-2xl p-4 flex items-start gap-3"
                  >
                    <span className="material-symbols-outlined text-[20px] text-primary mt-0.5 shrink-0">
                      flag
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-on-surface leading-snug">
                        {insight.title || insight.front_text}
                      </p>
                      {insight.problem?.name && (
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          {insight.problem.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Post-match block — only for PLAYED matches */}
        {isPlayed && (
          <>
            {/* Score */}
            {scoreText && (
              <section className="bg-surface-card rounded-2xl p-4 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                  {t(locale, "matches.detail.score")}
                </p>
                <p className="text-2xl font-black text-on-surface tracking-tight">
                  {scoreText}
                </p>
              </section>
            )}

            {/* Read-only goals (result view) */}
            {attachedInsights.length > 0 && (
              <section className="space-y-3">
                <p className="text-sm font-black uppercase tracking-widest text-on-surface">
                  {t(locale, "matches.detail.goalsReadOnly")}
                </p>
                <div className="space-y-2">
                  {attachedInsights.map((insight) => (
                    <div
                      key={insight.id}
                      className="bg-surface-card rounded-2xl p-4 flex items-start gap-3"
                    >
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant mt-0.5 shrink-0">
                        flag
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface leading-snug">
                          {insight.title || insight.front_text}
                        </p>
                        {insight.problem?.name && (
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {insight.problem.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Reflection textarea with auto-save */}
            <ReflectionTextarea
              matchId={match.id}
              initialValue={match.reflection ?? ""}
              locale={locale}
            />
          </>
        )}
      </main>
    </div>
  );
}
