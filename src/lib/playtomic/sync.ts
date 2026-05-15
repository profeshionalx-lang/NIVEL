import { createClient } from "@/lib/supabase/server";
import {
  fetchUserMatches,
  fetchMatch,
  parseMatchUrl,
  type PlaytomicMatch,
} from "./client";

const SYNC_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

interface SyncOptions {
  force?: boolean;
}

/**
 * Syncs all Playtomic matches for the given profile.
 *
 * Steps:
 * 1. Read playtomic_user_id and playtomic_synced_at from profiles.
 * 2. If no playtomic_user_id — exit early.
 * 3. If not forced and last sync was < 10 min ago — exit early.
 * 4. Fetch matches from Playtomic API.
 * 5. Filter: upcoming (start_date >= now) OR already in our DB (to refresh status/score).
 * 6. Upsert into matches. Do NOT overwrite reflection.
 * 7. Mark past matches with results as PLAYED.
 * 8. Update playtomic_synced_at = now().
 */
export async function syncUserMatches(
  profileId: string,
  opts: SyncOptions = {}
): Promise<void> {
  const supabase = await createClient();

  // 1. Read profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("playtomic_user_id, playtomic_synced_at")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) return;

  const { playtomic_user_id, playtomic_synced_at } = profile as {
    playtomic_user_id: string | null;
    playtomic_synced_at: string | null;
  };

  // 2. No Playtomic user linked
  if (!playtomic_user_id) return;

  // 3. Cooldown check
  if (!opts.force && playtomic_synced_at) {
    const lastSync = new Date(playtomic_synced_at).getTime();
    if (Date.now() - lastSync < SYNC_COOLDOWN_MS) return;
  }

  // 4. Fetch from Playtomic
  const remoteMatches = await fetchUserMatches(playtomic_user_id);

  if (remoteMatches.length > 0) {
    const now = new Date();

    // 5. Load existing match IDs from our DB for this profile
    const { data: existingRows } = await supabase
      .from("matches")
      .select("playtomic_match_id")
      .eq("profile_id", profileId);

    const existingIds = new Set(
      (existingRows ?? []).map(
        (r: { playtomic_match_id: string }) => r.playtomic_match_id
      )
    );

    // Filter: upcoming OR already in DB (to refresh status/score)
    const toSync = remoteMatches.filter((m) => {
      if (existingIds.has(m.match_id)) return true;
      if (!m.start_date) return false;
      return new Date(m.start_date) >= now;
    });

    if (toSync.length > 0) {
      await upsertMatches(supabase, profileId, toSync);
    }
  }

  // Always mark past matches with results as PLAYED, even when Playtomic returns
  // no matches (guarantees correct status for already-synced records).
  await markPlayedMatches(supabase, profileId);

  // 8. Update sync timestamp
  await supabase
    .from("profiles")
    .update({ playtomic_synced_at: new Date().toISOString() })
    .eq("id", profileId);
}

/**
 * Fetches a single match by Playtomic URL and upserts it.
 * Bypasses the 10-minute cooldown.
 */
export async function addMatchByUrl(
  profileId: string,
  url: string
): Promise<void> {
  const matchId = parseMatchUrl(url);
  if (!matchId) {
    throw new Error("Invalid Playtomic match URL");
  }

  const remoteMatch = await fetchMatch(matchId);
  if (!remoteMatch) {
    throw new Error("Could not fetch match from Playtomic");
  }

  const supabase = await createClient();
  await upsertMatches(supabase, profileId, [remoteMatch]);
  await markPlayedMatches(supabase, profileId);
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Upserts an array of Playtomic matches into our DB.
 * Does NOT overwrite the `reflection` field.
 */
async function upsertMatches(
  supabase: SupabaseClient,
  profileId: string,
  matches: PlaytomicMatch[]
): Promise<void> {
  const rows = matches.map((m) => ({
    profile_id: profileId,
    playtomic_match_id: m.match_id,
    start_date: m.start_date,
    end_date: m.end_date ?? null,
    location: m.location ?? null,
    resource_name: m.resource_name ?? null,
    status: m.status ?? null,
    teams: m.teams ?? null,
    results: m.results ?? null,
    last_synced_at: new Date().toISOString(),
  }));

  await supabase.from("matches").upsert(rows, {
    onConflict: "profile_id,playtomic_match_id",
    // reflection is not in the row, so Supabase will not touch it
    ignoreDuplicates: false,
  });
}

/**
 * Sets status = 'PLAYED' for past matches that have results.
 */
async function markPlayedMatches(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  const now = new Date().toISOString();

  await supabase
    .from("matches")
    .update({ status: "PLAYED" })
    .eq("profile_id", profileId)
    .lt("end_date", now)
    .not("results", "is", null)
    .neq("status", "PLAYED");
}
