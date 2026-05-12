import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { syncUserMatches } from "@/lib/playtomic/sync";
import { getLocale } from "@/lib/i18n";
import { t } from "@/lib/i18n/dict";
import MatchCard, { type MatchRow } from "@/components/matches/MatchCard";
import MatchesTabs from "@/components/matches/MatchesTabs";
import RefreshMatchesButton from "@/components/matches/RefreshMatchesButton";
import AddMatchByUrlModal from "@/components/matches/AddMatchByUrlModal";
import { Suspense } from "react";

const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MatchesPage({ searchParams }: PageProps) {
  const user = await getSession();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const { tab } = await searchParams;
  const activeTab: "upcoming" | "past" = tab === "past" ? "past" : "upcoming";

  // Lazy sync (10-min cooldown)
  await syncUserMatches(user.id);

  const supabase = await createClient();

  // Check if Playtomic is connected
  const { data: profile } = await supabase
    .from("profiles")
    .select("playtomic_user_id")
    .eq("id", user.id)
    .single();

  const playtomicConnected = !!(profile as { playtomic_user_id: string | null } | null)
    ?.playtomic_user_id;

  // Fetch matches with goal counts
  let upcomingMatches: MatchRow[] = [];
  let pastMatches: MatchRow[] = [];

  if (playtomicConnected) {
    const { data: allMatches } = await supabase
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
        match_goals(count)
      `
      )
      .eq("profile_id", user.id)
      .order("start_date", { ascending: activeTab === "upcoming" });

    const rows = (allMatches ?? []) as Array<{
      id: string;
      start_date: string;
      end_date: string | null;
      location: string | null;
      resource_name: string | null;
      status: string | null;
      teams: unknown;
      match_goals: Array<{ count: number }>;
    }>;

    const mapped: MatchRow[] = rows.map((r) => ({
      id: r.id,
      start_date: r.start_date,
      end_date: r.end_date,
      location: r.location,
      resource_name: r.resource_name,
      status: r.status,
      teams: r.teams,
      goalsCount: r.match_goals?.[0]?.count ?? 0,
    }));

    upcomingMatches = mapped.filter((m) =>
      UPCOMING_STATUSES.includes(m.status ?? "")
    );
    pastMatches = mapped.filter(
      (m) => !UPCOMING_STATUSES.includes(m.status ?? "")
    );
  }

  const displayedMatches = activeTab === "upcoming" ? upcomingMatches : pastMatches;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-nav h-16 flex items-center justify-between px-6">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          {t(locale, "matches.title")}
        </span>
        {playtomicConnected && (
          <div className="flex items-center gap-2">
            <RefreshMatchesButton locale={locale} />
            <AddMatchByUrlModal locale={locale} />
          </div>
        )}
      </header>

      <main className="px-4 pt-4 pb-36 max-w-[430px] mx-auto space-y-4">
        {!playtomicConnected ? (
          /* Empty state: Playtomic not connected */
          <div className="mt-12 flex flex-col items-center gap-4 text-center px-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant">
              sports_tennis
            </span>
            <p className="text-sm text-on-surface-variant">
              {t(locale, "matches.noPlaytomic")}
            </p>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 rounded-xl kinetic-gradient text-on-primary text-xs font-black uppercase tracking-widest"
            >
              {t(locale, "matches.goToSettings")}
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <Suspense>
              <MatchesTabs activeTab={activeTab} locale={locale} />
            </Suspense>

            {/* Match list */}
            {displayedMatches.length === 0 ? (
              <div className="mt-8 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant">
                  event_busy
                </span>
                <p className="text-sm text-on-surface-variant">
                  {activeTab === "upcoming"
                    ? t(locale, "matches.emptyUpcoming")
                    : t(locale, "matches.emptyPast")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    isUpcoming={activeTab === "upcoming"}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
