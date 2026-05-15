const PLAYTOMIC_API_BASE = "https://api.playtomic.io/v1";
const TIMEOUT_MS = 5000;

export interface PlaytomicMatch {
  match_id: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  resource_name: string | null;
  status: string;
  teams: unknown;
  results: unknown | null;
}

/**
 * Extracts user_id from Playtomic profile URL.
 * Supports both numeric IDs and UUIDs.
 * Both /profile/users/{id} (web) and /profile/user/{id} (Android share) are accepted.
 */
export function parseProfileUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/profile\/users?\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extracts match UUID from Playtomic match URL.
 * Example: https://app.playtomic.io/matches/some-uuid
 */
export function parseMatchUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/matches\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a single match by ID from Playtomic API.
 * Returns null on any error (network, timeout, non-2xx).
 */
export async function fetchMatch(matchId: string): Promise<PlaytomicMatch | null> {
  try {
    const res = await fetchWithTimeout(`${PLAYTOMIC_API_BASE}/matches/${encodeURIComponent(matchId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeMatch(data);
  } catch {
    return null;
  }
}

/**
 * Fetches all matches for a given Playtomic user ID.
 * Returns empty array on any error.
 */
export async function fetchUserMatches(userId: string): Promise<PlaytomicMatch[]> {
  try {
    const url = `${PLAYTOMIC_API_BASE}/matches?user_id=${encodeURIComponent(userId)}&size=200`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(normalizeMatch);
  } catch {
    return [];
  }
}

function normalizeMatch(raw: Record<string, unknown>): PlaytomicMatch {
  return {
    match_id: String(raw["match_id"] ?? raw["id"] ?? ""),
    start_date: String(raw["start_date"] ?? ""),
    end_date: raw["end_date"] != null ? String(raw["end_date"]) : null,
    location: raw["location_name"] != null ? String(raw["location_name"]) : null,
    resource_name: raw["resource_name"] != null ? String(raw["resource_name"]) : null,
    status: String(raw["status"] ?? ""),
    teams: raw["teams"] ?? null,
    results: raw["results"] ?? null,
  };
}
