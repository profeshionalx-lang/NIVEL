import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Business core for goal operations. Auth-agnostic: the caller resolves the
 * authenticated user (and role for trainer-only ops) and passes a ready
 * `supabase` client plus the relevant owner id. No "use server", no revalidate.
 */

type GoalResult =
  | { success: true; goalId: string }
  | { success: false; error: string };

export async function createGoalCore(
  supabase: SupabaseClient,
  userId: string,
  problemId: number | null,
  customProblem: string | null
): Promise<GoalResult> {
  try {
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({ user_id: userId, custom_problem: customProblem })
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

    return { success: true, goalId: goal.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function createGoalForStudentCore(
  supabase: SupabaseClient,
  studentId: string,
  problemId: number | null,
  customProblem: string | null
): Promise<GoalResult> {
  try {
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

    return { success: true, goalId: goal.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function cancelGoalCore(
  supabase: SupabaseClient,
  goalId: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { error: updateError } = await supabase
      .from("goals")
      .update({ status: "cancelled" })
      .eq("id", goalId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
