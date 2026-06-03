"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createGoalCore,
  createGoalForStudentCore,
  cancelGoalCore,
} from "@/lib/core/goals";

export async function createGoal(
  problemId: number | null,
  customProblem: string | null
): Promise<{ success: true; goalId: string } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };

  const supabase = await createClient();
  const result = await createGoalCore(supabase, user.id, problemId, customProblem);

  if (result.success) {
    revalidatePath("/dashboard");
  }
  return result;
}

export async function createGoalForStudent(
  studentId: string,
  problemId: number | null,
  customProblem: string | null
): Promise<{ success: true; goalId: string } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };
  if (user.role !== "trainer") return { success: false, error: "Forbidden" };

  const supabase = await createClient();
  const result = await createGoalForStudentCore(supabase, studentId, problemId, customProblem);

  if (result.success) {
    revalidatePath(`/trainer/students/${studentId}`);
    revalidatePath(`/dashboard`);
  }
  return result;
}

export async function cancelGoal(
  goalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const user = await getSession();
  if (!user) return { success: false, error: "Not authenticated" };

  const supabase = await createClient();
  const result = await cancelGoalCore(supabase, goalId);

  if (result.success) {
    revalidatePath("/dashboard");
  }
  return result;
}
