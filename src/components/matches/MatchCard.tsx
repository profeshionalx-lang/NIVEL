import Link from "next/link";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

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

export default function MatchCard({ match, isUpcoming, locale }: Props) {
  const players = extractPlayers(match.teams);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block bg-surface-card rounded-2xl p-4 space-y-3 hover:bg-surface-elevated transition-colors"
    >
      {/* Date + location */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-on-surface">
            {formatDate(match.start_date)}
          </p>
          {match.location && (
            <p className="text-xs text-on-surface-variant">{match.location}</p>
          )}
          {match.resource_name && (
            <p className="text-xs text-on-surface-variant">{match.resource_name}</p>
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

      {/* Players */}
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

      {/* Goals CTA (upcoming only) */}
      {isUpcoming && (
        <div className="flex items-center gap-2">
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
