"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createInsightCardCore,
  updateInsightCardCore,
  setTrainerCardStatusCore,
  deleteInsightCardCore,
  reorderInsightCardsCore,
  decideInsightCardCore,
  getVaultCardsCore,
  getStudentSessionsCore,
  applyTemplateToStudentCore,
  createCollectionCore,
  addCardToCollectionCore,
  removeCardFromCollectionCore,
  applyCollectionToStudentCore,
  type StudentSessionOption,
  type VaultFilters,
} from "@/lib/core/insightCards";
import type { InsightCardWithRelations, InsightStudentDecision } from "@/lib/types";

export type { StudentSessionOption, VaultFilters };

type Result<T = void> =
  | (T extends void ? { success: true } : { success: true } & T)
  | { success: false; error: string };

/** Resolves the authenticated user + a supabase client (no role check). */
async function requireAuth() {
  const user = await getSession();
  if (!user) return { ok: false as const, error: "Not authenticated" };
  const supabase = await createClient();
  return { ok: true as const, supabase, userId: user.id, role: user.role };
}

/** @deprecated Cards are created via AI paste flow only. No UI calls this. */
export async function createInsightCard(
  sessionId: string,
  payload: {
    frontText: string;
    contextText?: string | null;
    problemId?: number | null;
  }
): Promise<Result<{ id: string }>> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await createInsightCardCore(auth.supabase, auth.userId, sessionId, payload);
  if (!result.success) return result;

  revalidatePath(`/trainer/sessions/${sessionId}/insights`);
  return { success: true, id: result.id };
}

export async function updateInsightCard(
  cardId: string,
  patch: {
    frontText?: string;
    contextText?: string | null;
    problemId?: number | null;
    tags?: string[] | null;
  }
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await updateInsightCardCore(auth.supabase, cardId, patch);
  if (!result.success) return result;

  revalidatePath(`/trainer/sessions/${result.sessionId}/insights`);
  return { success: true };
}

export async function setTrainerCardStatus(
  cardId: string,
  status: "approved" | "rejected" | "draft"
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await setTrainerCardStatusCore(auth.supabase, cardId, status);
  if (!result.success) return result;

  revalidatePath(`/trainer/sessions/${result.sessionId}/insights`);
  revalidatePath(`/sessions/${result.sessionId}`);
  return { success: true };
}

export async function deleteInsightCard(cardId: string): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await deleteInsightCardCore(auth.supabase, cardId);
  if (!result.success) return result;

  if (result.sessionId) {
    revalidatePath(`/trainer/sessions/${result.sessionId}/insights`);
  }
  return { success: true };
}

export async function reorderInsightCards(
  sessionId: string,
  orderedIds: string[]
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await reorderInsightCardsCore(auth.supabase, sessionId, orderedIds);
  if (!result.success) return result;

  revalidatePath(`/trainer/sessions/${sessionId}/insights`);
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath(`/sessions/${sessionId}/insights`);
  return { success: true };
}

export async function decideInsightCard(
  cardId: string,
  decision: InsightStudentDecision,
  editedText?: string
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await decideInsightCardCore(auth.supabase, auth.userId, cardId, decision, editedText);
  if (!result.success) return result;

  revalidatePath(`/sessions/${result.sessionId}`);
  revalidatePath(`/sessions/${result.sessionId}/insights`);
  revalidatePath("/insights");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getVaultCards(
  filters: VaultFilters = {}
): Promise<InsightCardWithRelations[]> {
  const auth = await requireAuth();
  if (!auth.ok) return [];

  return getVaultCardsCore(auth.supabase, auth.userId, filters);
}

export async function getStudentSessions(
  studentId: string
): Promise<StudentSessionOption[]> {
  const auth = await requireAuth();
  if (!auth.ok || auth.role !== "trainer") return [];

  return getStudentSessionsCore(auth.supabase, studentId);
}

export async function applyTemplateToStudent(
  templateId: string,
  sessionId: string
): Promise<Result<{ id: string }>> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await applyTemplateToStudentCore(auth.supabase, auth.userId, templateId, sessionId);
  if (!result.success) return result;

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, id: result.id };
}

export async function createCollection(name: string): Promise<Result<{ id: string }>> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await createCollectionCore(auth.supabase, auth.userId, name);
  if (!result.success) return result;

  revalidatePath("/trainer/cards");
  return { success: true, id: result.id };
}

export async function addCardToCollection(
  collectionId: string,
  templateId: string
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await addCardToCollectionCore(auth.supabase, collectionId, templateId);
  if (!result.success) return result;

  revalidatePath("/trainer/cards");
  return { success: true };
}

export async function removeCardFromCollection(
  collectionId: string,
  templateId: string
): Promise<Result> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await removeCardFromCollectionCore(auth.supabase, collectionId, templateId);
  if (!result.success) return result;

  revalidatePath("/trainer/cards");
  return { success: true };
}

export async function applyCollectionToStudent(
  collectionId: string,
  sessionId: string
): Promise<Result<{ applied: number }>> {
  const auth = await requireAuth();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await applyCollectionToStudentCore(auth.supabase, auth.userId, collectionId, sessionId);
  if (!result.success) return result;

  revalidatePath(`/sessions/${sessionId}`);
  return { success: true, applied: result.applied };
}
