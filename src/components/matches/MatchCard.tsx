import Link from "next/link";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";
import { parseSetScores, computeWinner } from "@/lib/playtomic/score";

interface Player {
  name?: string;
  level?: number;
  [key: string]: unknown;
}

interface Team {
  players?: Player[];
  [key: string]: unknown;
}

export interface MatchRow {
  id: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  resource_name: string | null;
  status: string | null;
  teams: unknown;
  results?: unknown;
  goalsCount?: number;
}

interface Props {
  match: MatchRow;
  isUpcoming: boolean;
  locale: Locale;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractTeams(teams: unknown): Team[] {
  if (!Array.isArray(teams)) return [];
  return (teams as Team[]).slice(0, 2);
}

function teamNames(team: Team | undefined): string[] {
  if (!team || !Array.isArray(team.players)) return [];
  return (team.players as Player[]).slice(0, 2).map((p) => p.name ?? "—");
}

export default function MatchCard({ match, isUpcoming, locale }: Props) {
  const teams = extractTeams(match.teams);
  const sets = parseSetScores(match.results);
  const winner = computeWinner(match.results);
  const hasScore = sets.length > 0;

  // Счёт по сетам для конкретной команды (0 = local, 1 = visitor).
  const teamSetScores = (teamIdx: 0 | 1) =>
    sets.map((s) => (teamIdx === 0 ? s.local : s.visitor));

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block bg-surface-card rounded-2xl overflow-hidden hover:bg-surface-elevated transition-colors"
    >
      {/* Header: дата/место + статус */}
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-bold text-on-surface">
            {formatDate(match.start_date)}
          </p>
          {match.location && (
            <p className="text-xs text-on-surface-variant truncate">{match.location}</p>
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

      {/* Teams + score (Playtomic-style: две строки команд, счёт по сетам справа) */}
      {teams.length > 0 && (
        <div className="border-t border-border-dim/60">
          {([0, 1] as const).map((teamIdx) => {
            const names = teamNames(teams[teamIdx]);
            const isWinner = winner === teamIdx;
            const scores = teamSetScores(teamIdx);
            return (
              <div
                key={teamIdx}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 ${
                  teamIdx === 0 ? "border-b border-border-dim/40" : ""
                } ${isWinner ? "bg-primary/[0.07]" : ""}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {hasScore && (
                    <span
                      className={`material-symbols-outlined text-[16px] shrink-0 ${
                        isWinner ? "text-primary" : "text-transparent"
                      }`}
                    >
                      emoji_events
                    </span>
                  )}
                  <div className="min-w-0">
                    {names.length > 0 ? (
                      names.map((n, i) => (
                        <p
                          key={i}
                          className={`text-xs truncate ${
                            isWinner
                              ? "font-bold text-on-surface"
                              : "font-medium text-on-surface-variant"
                          }`}
                        >
                          {n}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-on-surface-variant">—</p>
                    )}
                  </div>
                </div>
                {hasScore && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {scores.map((sc, i) => (
                      <span
                        key={i}
                        className={`w-5 text-center text-sm tabular-nums ${
                          isWinner
                            ? "font-black text-on-surface"
                            : "font-semibold text-on-surface-variant"
                        }`}
                      >
                        {sc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goals CTA (upcoming only) */}
      {isUpcoming && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border-dim/60">
          <span className="material-symbols-outlined text-[16px] text-primary">
            flag
          </span>
          {(match.goalsCount ?? 0) > 0 ? (
            <span className="text-xs text-primary font-bold">
              {match.goalsCount} {t(locale, "matches.goalsCount")}
            </span>
          ) : (
            <span className="text-xs text-on-surface-variant">
              {t(locale, "matches.setGoals")}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
