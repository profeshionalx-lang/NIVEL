"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createSessionCore,
  maybeCompleteSessionCore,
  setTrainerReviewCompletedCore,
  createSessionForStudentCore,
} from "@/lib/core/sessions";

export async function createSession(
  goalId: string,
  studentId: string,
  exercises: { name: string; skillNames: string[] }[]
): Promise<{ success: true; sessionId: string } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };
  if (user.role !== "trainer") return { success: false, error: "Only trainers can create sessions" };

  const supabase = await createClient();
  const result = await createSessionCore(supabase, goalId, studentId, exercises);

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath(`/sessions/${result.sessionId}`);
    revalidatePath(`/goals/${goalId}`);
  }
  return result;
}

/**
 * Marks a session as completed if (a) trainer has finished reviewing insight cards
 * and (b) every approved card has a student_decision. Safe to call repeatedly.
 */
export async function maybeCompleteSession(
  sessionId: string
): Promise<{ completed: boolean }> {
  const supabase = await createClient();
  return maybeCompleteSessionCore(supabase, sessionId);
}

export async function setTrainerReviewCompleted(
  sessionId: string,
  completed: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSession();
  if (!user || user.role !== "trainer") {
    return { success: false, error: "Only trainers can finish review" };
  }

  const supabase = await createClient();
  const result = await setTrainerReviewCompletedCore(supabase, sessionId, completed);

  if (result.success) {
    revalidatePath("/dashboard");
    revalidatePath(`/sessions/${sessionId}`);
    revalidatePath(`/trainer/sessions/${sessionId}/insights`);
  }

  return result;
}

export async function createSessionForStudent(
  studentId: string,
  goalId: string,
  payload: {
    scheduledAt?: string | null;
    completedAt?: string | null;
    trainerNotes?: string | null;
    status?: "planned" | "completed";
  }
): Promise<{ success: true; sessionId: string } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };
  if (user.role !== "trainer") return { success: false, error: "Forbidden" };

  const supabase = await createClient();
  const result = await createSessionForStudentCore(supabase, studentId, goalId, payload);

  if (result.success) {
    revalidatePath(`/trainer/students/${studentId}`);
    revalidatePath("/dashboard");
  }
  return result;
}
