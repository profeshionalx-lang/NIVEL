import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Auth-agnostic execution context for business-core functions.
 *
 * Resolved by the caller — a web Server Action (cookie → getSession) or a
 * future `/api/v1` Route Handler (bearer → getSession) — and passed in
 * explicitly. Core functions in `src/lib/core/*` never touch cookies,
 * headers, `getSession`, `createClient`, `revalidatePath`, or `redirect`;
 * they receive an already-authenticated `user` and a ready `supabase` client.
 *
 * This keeps a single business core shared by both web and REST clients
 * (see A1 in docs/plans/2026-06-03-nivel-android-native-design.md).
 */
export type CoreContext = {
  user: SessionUser;
  supabase: SupabaseClient;
};

// Re-export ownership types/helpers so core+API consumers have one entry point.
export type { OwnershipContext, CardOwnershipContext } from "@/lib/auth/ownership";
export { requireTrainerOwnsSession, requireTrainerOwnsCard } from "@/lib/auth/ownership";
