"use server";

import { randomBytes } from "crypto";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const CLAIM_TTL_DAYS = 30;

function generateToken(): string {
  // 32 bytes → 64 hex chars. URL-safe out of the box.
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

async function requireTrainer() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  if (session.role !== "trainer") throw new Error("forbidden");
  return session;
}

export type CreateShadowStudentInput = {
  full_name: string;
};

export type CreateShadowStudentResult = {
  studentId: string;
  claimUrl: string;
  claimToken: string;
  expiresAt: string;
};

export async function createShadowStudent(
  input: CreateShadowStudentInput
): Promise<CreateShadowStudentResult> {
  const trainer = await requireTrainer();

  const full_name = input.full_name?.trim();
  if (!full_name) throw new Error("full_name is required");

  const supabase = await createClient();

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  // Email is left NULL on purpose — it will be filled from the Firebase token
  // when the student claims the profile.
  const { data: created, error } = await supabase
    .from("profiles")
    .insert({
      email: null,
      full_name,
      role: "student",
      created_by: trainer.id,
      claim_token: claimToken,
      claim_expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create shadow student: ${error?.message}`);
  }

  return {
    studentId: created.id,
    claimUrl: buildClaimUrl(claimToken),
    claimToken,
    expiresAt,
  };
}

export async function regenerateClaimToken(
  studentId: string
): Promise<CreateShadowStudentResult> {
  await requireTrainer();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, claimed_at")
    .eq("id", studentId)
    .maybeSingle();
  if (!existing) throw new Error("not_found");
  if (existing.claimed_at) throw new Error("already_claimed");

  const claimToken = generateToken();
  const expiresAt = expiryFromNow();

  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: claimToken, claim_expires_at: expiresAt })
    .eq("id", studentId);
  if (error) throw new Error(`Failed to regenerate token: ${error.message}`);

  return {
    studentId,
    claimUrl: buildClaimUrl(claimToken),
    claimToken,
    expiresAt,
  };
}

export async function revokeClaimToken(studentId: string): Promise<void> {
  await requireTrainer();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ claim_token: null, claim_expires_at: null })
    .eq("id", studentId);
  if (error) throw new Error(`Failed to revoke token: ${error.message}`);
}

export async function updateStudentProfile(
  studentId: string,
  patch: { full_name?: string | null; avatar_url?: string | null }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireTrainer();
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", studentId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

export type StudentInvite = {
  token: string;
  status: "none" | "pending" | "claimed" | "revoked";
  claimed_at: string | null;
};

export async function getStudentInvite(
  studentId: string
): Promise<StudentInvite | null> {
  await requireTrainer();
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("claim_token, claimed_at")
    .eq("id", studentId)
    .maybeSingle();

  if (!data) return null;

  if (data.claimed_at) {
    return { token: data.claim_token ?? "", status: "claimed", claimed_at: data.claimed_at };
  }
  if (!data.claim_token) {
    return { token: "", status: "none", claimed_at: null };
  }
  return { token: data.claim_token, status: "pending", claimed_at: null };
}

export async function regenerateInvite(
  studentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await regenerateClaimToken(studentId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function revokeInvite(
  studentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await revokeClaimToken(studentId);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
