"use server";

import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createShadowStudentCore,
  regenerateClaimTokenCore,
  revokeClaimTokenCore,
  updateStudentProfileCore,
  type ShadowStudentResult,
} from "@/lib/core/students";

async function requireTrainer() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  if (session.role !== "trainer") throw new Error("forbidden");
  return session;
}

export type CreateShadowStudentInput = {
  full_name: string;
};

export type CreateShadowStudentResult = ShadowStudentResult;

export async function createShadowStudent(
  input: CreateShadowStudentInput
): Promise<CreateShadowStudentResult> {
  const trainer = await requireTrainer();
  const supabase = await createClient();

  const result = await createShadowStudentCore(supabase, trainer.id, input.full_name);
  if (!result.success) throw new Error(result.error);
  return result.result;
}

export async function regenerateClaimToken(
  studentId: string
): Promise<CreateShadowStudentResult> {
  await requireTrainer();
  const supabase = await createClient();

  const result = await regenerateClaimTokenCore(supabase, studentId);
  if (!result.success) throw new Error(result.error);
  return result.result;
}

export async function revokeClaimToken(studentId: string): Promise<void> {
  await requireTrainer();
  const supabase = await createClient();

  const result = await revokeClaimTokenCore(supabase, studentId);
  if (!result.success) throw new Error(result.error);
}

export async function updateStudentProfile(
  studentId: string,
  patch: { full_name?: string | null; avatar_url?: string | null }
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requireTrainer();
    const supabase = await createClient();
    return await updateStudentProfileCore(supabase, studentId, patch);
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
