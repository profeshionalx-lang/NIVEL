import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Business core for trainer-managed student profiles and claim invitations.
 * Auth-agnostic: callers verify the user is a trainer and pass a ready
 * `supabase` client plus the trainer id. No "use server", no revalidate.
 * Both the web Server Actions and `/api/v1` wrap these.
 */

const CLAIM_TTL_DAYS = 30;

function generateToken(): string {
  // 32 bytes -> 64 hex chars. URL-safe out of the box.
  return randomBytes(32).toString("hex");
}

function expiryFromNow(days = CLAIM_TTL_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function buildClaimUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_NIVEL_URL?.trim();
  if (!base) throw new Error("NEXT_PUBLIC_NIVEL_URL is not set");
  return `${base.replace(/\/$/, "")}/invite/${token}`;
}

export type ShadowStudentResult = {
  studentId: string;
  claimUrl: string;
  claimToken: string;
  expiresAt: string;
};

type Ok<T = object> = { success: true } & T;
type Err = { success: false; error: string };

export async function createShadowStudentCore(
  supabase: SupabaseClient,
  trainerId: string,
  fullName: string
): Promise<Ok<{ result: ShadowStudentResult }> | Err> {
  const full_name = fullName?.trim();
  if (!full_name) return { success: false, error: "full_name is required" };

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  // Email is left NULL on purpose — it is filled from the Firebase token when
  // the student claims the profile.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      email: null,
      full_name,
      role: "student",
      created_by: trainerId,
      claim_token: claimToken,
      claim_expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !created) {
    return {
      success: false,
      error: error?.message ?? "Failed to create shadow student",
    };
  }

  return {
    success: true,
    result: {
      studentId: created.id,
      claimUrl: buildClaimUrl(claimToken),
      claimToken,
      expiresAt,
    },
  };
}

export async function regenerateClaimTokenCore(
  supabase: SupabaseClient,
  studentId: string
): Promise<Ok<{ result: ShadowStudentResult }> | Err> {
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, claimed_at")
    .eq("id", studentId)
    .maybeSingle();
  if (!existing) return { success: false, error: "not_found" };
  if (existing.claimed_at) return { success: false, error: "already_claimed" };

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: claimToken, claim_expires_at: expiresAt })
    .eq("id", studentId);
  if (error) {
    return { success: false, error: `Failed to regenerate token: ${error.message}` };
  }

  return {
    success: true,
    result: {
      studentId,
      claimUrl: buildClaimUrl(claimToken),
      claimToken,
      expiresAt,
    },
  };
}

export async function revokeClaimTokenCore(
  supabase: SupabaseClient,
  studentId: string
): Promise<Ok | Err> {
  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: null, claim_expires_at: null })
    .eq("id", studentId);
  if (error) {
    return { success: false, error: `Failed to revoke token: ${error.message}` };
  }
  return { success: true };
}

export async function updateStudentProfileCore(
  supabase: SupabaseClient,
  studentId: string,
  patch: { full_name?: string | null; avatar_url?: string | null }
): Promise<Ok | Err> {
  const update: Record<string, unknown> = {};
  if (patch.full_name !== undefined) update.full_name = patch.full_name;
  if (patch.avatar_url !== undefined) update.avatar_url = patch.avatar_url;

  if (Object.keys(update).length === 0) {
    return { success: false, error: "Nothing to update" };
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", studentId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
