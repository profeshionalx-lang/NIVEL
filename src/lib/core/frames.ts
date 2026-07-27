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
 * The shape `attachFrameUrls` returns for a given row type: raw paths
 * replaced by signed URLs. Use this (not `T` itself) to type props of any
 * `"use client"` component or DTO downstream of `attachFrameUrls` — the
 * removed path fields must not be reintroduced by a stale type annotation.
 */
export type WithFrameUrls<T extends FramePaths> = Omit<
  T,
  "frame_before_path" | "frame_after_path"
> &
  FrameUrls;

/**
 * Batch-signs `frame_before_path`/`frame_after_path` for a whole list of cards
 * (or any row shape carrying those two columns) and returns the same rows with
 * `frame_before_url`/`frame_after_url` attached **in place of** the raw paths.
 * One `createSignedUrls` call total regardless of list length.
 *
 * The paths are deliberately dropped from the output, not just added
 * alongside the URLs: several callers pass the result straight into
 * `"use client"` components, and Next.js serializes the *entire* prop object
 * into the RSC flight payload sent to the browser regardless of whether the
 * component renders a given field. `session-frames` is a private bucket
 * specifically because frames can show identifiable people, often minors
 * (NIVEL#235) — the raw Storage path must never reach the client, signed or
 * not.
 */
export async function attachFrameUrls<T extends FramePaths>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<Array<Omit<T, "frame_before_path" | "frame_after_path"> & FrameUrls>> {
  if (rows.length === 0) return [];

  const paths = rows.flatMap((r) => [r.frame_before_path, r.frame_after_path]);
  const urlMap = await signFramePaths(supabase, paths);

  return rows.map((r) => {
    const { frame_before_path, frame_after_path, ...rest } = r;
    return {
      ...rest,
      frame_before_url: frame_before_path ? urlMap.get(frame_before_path) ?? null : null,
      frame_after_url: frame_after_path ? urlMap.get(frame_after_path) ?? null : null,
    };
  });
}
