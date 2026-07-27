import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single place that turns `insight_cards.frame_*_path` (private Storage paths)
 * into short-lived signed URLs for clients (web + Android). Bucket is private
 * — frames can show identifiable people, often minors (see NIVEL#235) — so a
 * URL is never stored, only signed on read.
 *
 * If the bucket is ever switched to public, this is the one function to
 * change (swap `createSignedUrls` for `getPublicUrl`).
 */

const SESSION_FRAMES_BUCKET = "session-frames";

/** 24h — long enough that Coil/browser caches don't refetch every screen, short
 * enough that a leaked URL doesn't stay valid indefinitely. Keep in sync with
 * NIVEL#241/#235 discussion. Must NOT be baked into a Next.js `use cache`
 * scope with a longer TTL than this. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

/**
 * Signs a batch of Storage paths in `session-frames` in a single
 * `createSignedUrls` call — callers must gather every path for a whole list of
 * cards up front rather than calling this per-card (see NIVEL#241 acceptance:
 * one session with 10 cards = one signing call, not N).
 *
 * Returns a `path -> signedUrl` map. Falsy/duplicate paths are ignored; paths
 * Storage fails to sign (deleted object, race with delete) are simply absent
 * from the map rather than throwing, so callers can treat "not in the map" the
 * same as "no frame" via `?? null`.
 */
export async function signFramePaths(
  supabase: SupabaseClient,
  paths: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const uniquePaths = Array.from(new Set(paths.filter((p): p is string => !!p)));
  if (uniquePaths.length === 0) return new Map();

  const { data, error } = await supabase.storage
    .from(SESSION_FRAMES_BUCKET)
    .createSignedUrls(uniquePaths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error("signFramePaths:", error?.message ?? "no data returned");
    return new Map();
  }

  const map = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) {
      map.set(item.path, item.signedUrl);
    }
  }
  return map;
}

export interface FramePaths {
  frame_before_path: string | null;
  frame_after_path: string | null;
}

export interface FrameUrls {
  frame_before_url: string | null;
  frame_after_url: string | null;
}

/**
 * Batch-signs `frame_before_path`/`frame_after_path` for a whole list of cards
 * (or any row shape carrying those two columns) and returns the same rows with
 * `frame_before_url`/`frame_after_url` attached. One `createSignedUrls` call
 * total regardless of list length.
 *
 * The raw paths are **redacted to `null`** in the returned rows (not just left
 * alongside the new URL fields): several callers pass the result straight
 * into `"use client"` components, and Next.js serializes the *entire* prop
 * object into the RSC flight payload sent to the browser regardless of
 * whether the component renders a given field. `session-frames` is a private
 * bucket specifically because frames can show identifiable people, often
 * minors (NIVEL#235) — the raw Storage path must never reach the client,
 * signed or not. Redacting the value (rather than deleting the key) keeps the
 * return type identical to the input type `T`, so this drops into any
 * existing `InsightCard`/`InsightCardWithRelations`-typed prop or DTO without
 * a cascade of type changes downstream.
 */
export async function attachFrameUrls<T extends FramePaths>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<T & FrameUrls>> {
  if (rows.length === 0) return [];

  const paths = rows.flatMap((r) => [r.frame_before_path, r.frame_after_path]);
  const urlMap = await signFramePaths(supabase, paths);

  return rows.map((r) => ({
    ...r,
    frame_before_path: null,
    frame_after_path: null,
    frame_before_url: r.frame_before_path ? urlMap.get(r.frame_before_path) ?? null : null,
    frame_after_url: r.frame_after_path ? urlMap.get(r.frame_after_path) ?? null : null,
  }));
}
