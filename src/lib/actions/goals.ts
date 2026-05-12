"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function createGoal(
  problemId: number | null,
  customProblem: string | null
): Promise<{ success: true; goalId: string } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };

    const supabase = await createClient();

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({ user_id: user.id, custom_problem: customProblem })
      .select("id")
      .single();

    if (goalError || !goal) {
      return { success: false, error: goalError?.message ?? "Failed to create goal" };
    }

    if (problemId) {
      const { error: problemsError } = await supabase
        .from("goal_problems")
        .insert({ goal_id: goal.id, problem_id: problemId });

      if (problemsError) {
        return { success: false, error: problemsError.message };
      }
    }

    revalidatePath("/dashboard");

    return { success: true, goalId: goal.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function createGoalForStudent(
  studentId: string,
  problemId: number | null,
  customProblem: string | null
): Promise<{ success: true; goalId: string } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };
    if (user.role !== "trainer") return { success: false, error: "Forbidden" };

    const supabase = await createClient();

    const { data: student } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", studentId)
      .single();
    if (!student) return { success: false, error: "Student not found" };

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({ user_id: studentId, custom_problem: customProblem })
      .select("id")
      .single();

    if (goalError || !goal) {
      return { success: false, error: goalError?.message ?? "Failed to create goal" };
    }

    if (problemId) {
      const { error: problemsError } = await supabase
        .from("goal_problems")
        .insert({ goal_id: goal.id, problem_id: problemId });

      if (problemsError) {
        return { success: false, error: problemsError.message };
      }
    }

    revalidatePath(`/trainer/students/${studentId}`);
    revalidatePath(`/dashboard`);

    return { success: true, goalId: goal.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function cancelGoal(
  goalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };

    const supabase = await createClient();

    const { error: updateError } = await supabase
      .from("goals")
      .update({ status: "cancelled" })
      .eq("id", goalId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
