"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSession(
  goalId: string,
  studentId: string,
  exercises: { name: string; skillNames: string[] }[]
): Promise<{ success: true; sessionId: string } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    // 1. Verify current user is a trainer
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, error: "Profile not found" };
    }

    if (profile.role !== "trainer") {
      return { success: false, error: "Only trainers can create sessions" };
    }

    // 2. Get the next session number for this goal
    const { count, error: countError } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("goal_id", goalId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const sessionNumber = (count ?? 0) + 1;

    // 3. Resolve exercises and skills (create if they don't exist)
    const resolvedExercises: { exerciseId: number; skillIds: number[] }[] = [];

    for (const exercise of exercises) {
      // Check if exercise exists (case-insensitive)
      let { data: existingExercise } = await supabase
        .from("exercises")
        .select("id")
        .ilike("name", exercise.name)
        .single();

      if (!existingExercise) {
        const { data: newExercise, error: insertExError } = await supabase
          .from("exercises")
          .insert({ name: exercise.name })
          .select("id")
          .single();

        if (insertExError || !newExercise) {
          return {
            success: false,
            error: insertExError?.message ?? "Failed to create exercise",
          };
        }
        existingExercise = newExercise;
      }

      const skillIds: number[] = [];

      for (const skillName of exercise.skillNames) {
        let { data: existingSkill } = await supabase
          .from("skills")
          .select("id")
          .ilike("name", skillName)
          .single();

        if (!existingSkill) {
          const { data: newSkill, error: insertSkillError } = await supabase
            .from("skills")
            .insert({ name: skillName })
            .select("id")
            .single();

          if (insertSkillError || !newSkill) {
            return {
              success: false,
              error: insertSkillError?.message ?? "Failed to create skill",
            };
          }
          existingSkill = newSkill;
        }

        skillIds.push(existingSkill.id);
      }

      resolvedExercises.push({ exerciseId: existingExercise.id, skillIds });
    }

    // 4. Insert session row
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        goal_id: goalId,
        session_number: sessionNumber,
        status: "planned",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      return {
        success: false,
        error: sessionError?.message ?? "Failed to create session",
      };
    }

    // 5. Insert session_exercises and session_exercise_skills
    for (let i = 0; i < resolvedExercises.length; i++) {
      const { exerciseId, skillIds } = resolvedExercises[i];

      const { data: sessionExercise, error: seError } = await supabase
        .from("session_exercises")
        .insert({
          session_id: session.id,
          exercise_id: exerciseId,
          sort_order: i + 1,
        })
        .select("id")
        .single();

      if (seError || !sessionExercise) {
        return {
          success: false,
          error: seError?.message ?? "Failed to create session exercise",
        };
      }

      if (skillIds.length > 0) {
        const sessionExerciseSkills = skillIds.map((skillId) => ({
          session_exercise_id: sessionExercise.id,
          skill_id: skillId,
        }));

        const { error: sesError } = await supabase
          .from("session_exercise_skills")
          .insert(sessionExerciseSkills);

        if (sesError) {
          return { success: false, error: sesError.message };
        }
      }
    }

    // 6. Increment skill progress for each unique skill
    const uniqueSkillIds = [
      ...new Set(resolvedExercises.flatMap((e) => e.skillIds)),
    ];

    for (const skillId of uniqueSkillIds) {
      const { error: rpcError } = await supabase.rpc("increment_skill_progress", {
        p_user_id: studentId,
        p_skill_id: skillId,
      });

      if (rpcError) {
        console.error("Failed to increment skill progress:", rpcError.message);
      }
    }

    // 7. Check if goal is now completed
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("session_count")
      .eq("id", goalId)
      .single();

    if (!goalError && goal && sessionNumber >= goal.session_count) {
      await supabase
        .from("goals")
        .update({ status: "completed" })
        .eq("id", goalId);
    }

    // 8. Revalidate paths
    revalidatePath("/dashboard");
    revalidatePath(`/sessions/${session.id}`);
    revalidatePath(`/goals/${goalId}`);

    return { success: true, sessionId: session.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function submitStudentInsight(
  sessionId: string,
  insight: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Fetch current session to check if trainer_notes already exists
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("trainer_notes, goal_id")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: fetchError?.message ?? "Session not found" };
    }

    const updateData: Record<string, unknown> = { student_insight: insight };

    if (session.trainer_notes) {
      updateData.status = "completed";
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/sessions/${sessionId}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function submitTrainerNotes(
  sessionId: string,
  notes: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    // Verify trainer role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "trainer") {
      return { success: false, error: "Only trainers can submit notes" };
    }

    // Fetch current session to check if student_insight already exists
    const { data: session, error: fetchError } = await supabase
      .from("sessions")
      .select("student_insight, goal_id")
      .eq("id", sessionId)
      .single();

    if (fetchError || !session) {
      return { success: false, error: fetchError?.message ?? "Session not found" };
    }

    const updateData: Record<string, unknown> = { trainer_notes: notes };

    if (session.student_insight) {
      updateData.status = "completed";
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("sessions")
      .update(updateData)
      .eq("id", sessionId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/sessions/${sessionId}`);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
