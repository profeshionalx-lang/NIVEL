import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyNewInsights, notifyStudentCompletedReview } from "@/lib/telegram/notify";

/**
 * Business core for training-session operations. Auth-agnostic: callers verify
 * the user is a trainer (and owns the relevant student/goal) and pass a ready
 * `supabase` client. No "use server", no revalidate. Telegram notifications and
 * the `increment_skill_progress` RPC stay here — both web and `/api/v1` need them.
 */

type CreateResult =
  | { success: true; sessionId: string }
  | { success: false; error: string };

export async function createSessionCore(
  supabase: SupabaseClient,
  goalId: string,
  studentId: string,
  exercises: { name: string; skillNames: string[] }[]
): Promise<CreateResult> {
  try {
    // 1. Get the next session number for this goal
    const { count, error: countError } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("goal_id", goalId);

    if (countError) {
      return { success: false, error: countError.message };
    }

    const sessionNumber = (count ?? 0) + 1;

    // 2. Resolve exercises and skills (create if they don't exist)
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

    // 3. Insert session row
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

    // 4. Insert session_exercises and session_exercise_skills
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

    // 5. Increment skill progress for each unique skill
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

    return { success: true, sessionId: session.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

/**
 * Marks a session as completed if (a) trainer has finished reviewing insight cards
 * and (b) every approved card has a student_decision. Safe to call repeatedly.
 */
export async function maybeCompleteSessionCore(
  supabase: SupabaseClient,
  sessionId: string
): Promise<{ completed: boolean }> {
  const { data: session } = await supabase
    .from("sessions")
    .select("status, trainer_review_completed")
    .eq("id", sessionId)
    .single();

  if (!session || session.status === "completed") {
    return { completed: session?.status === "completed" };
  }

  if (!session.trainer_review_completed) {
    return { completed: false };
  }

  const { count: pending } = await supabase
    .from("insight_cards")
    .select("*", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("trainer_status", "approved")
    .is("student_decision", null);

  if ((pending ?? 0) > 0) {
    return { completed: false };
  }

  // Атомарная транзиция planned → completed. При гонке/повторном вызове
  // .select() вернёт [] для всех проигравших — пуш тренеру отправится ровно один раз.
  const { data: updatedRows } = await supabase
    .from("sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "planned")
    .select("id, session_number, goal_id");

  const transitionedToCompleted = (updatedRows?.length ?? 0) > 0;

  if (transitionedToCompleted) {
    const updated = updatedRows![0];
    // Assumption: одна сессия = один тренер. Проверено перед стартом задачи:
    //   select count(*) from (select session_id, count(distinct trainer_id) c
    //   from insight_cards group by session_id) t where t.c > 1; -- 0 строк.
    // Если в будущем co-coaching — пересмотреть источник.
    const { data: cardRow } = await supabase
      .from("insight_cards")
      .select("trainer_id")
      .eq("session_id", sessionId)
      .limit(1)
      .maybeSingle();
    const { data: studentRow } = await supabase
      .from("goals")
      .select("profiles!inner(full_name)")
      .eq("id", updated.goal_id)
      .single();

    const trainerId = cardRow?.trainer_id as string | undefined;
    const profilesField =
      (studentRow as { profiles?: { full_name?: string | null } | { full_name?: string | null }[] | null } | null)
        ?.profiles;
    const rawName = Array.isArray(profilesField)
      ? profilesField[0]?.full_name
      : profilesField?.full_name;
    const name = rawName?.trim() || "Ученик";

    if (trainerId) {
      await notifyStudentCompletedReview(trainerId, sessionId, name, updated.session_number);
    }
  }

  // К этой точке мы дошли через ранние проверки (планируется + ревью завершено + decisions есть).
  // Если update не сработал — значит параллельный вызов уже перевёл в completed. В любом случае
  // сессия сейчас в completed → возвращаем true, сохраняя семантику оригинала.
  return { completed: true };
}

export async function setTrainerReviewCompletedCore(
  supabase: SupabaseClient,
  sessionId: string,
  completed: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  let transitionedToTrue = false;

  if (completed === true) {
    // Atomic guard: only the request that flips false → true wins this update.
    // Concurrent double-clicks see zero affected rows on the loser.
    const { data: updatedRows, error } = await supabase
      .from("sessions")
      .update({ trainer_review_completed: true })
      .eq("id", sessionId)
      .eq("trainer_review_completed", false)
      .select("id");

    if (error) return { success: false, error: error.message };
    transitionedToTrue = (updatedRows?.length ?? 0) > 0;
  } else {
    const { error } = await supabase
      .from("sessions")
      .update({ trainer_review_completed: false })
      .eq("id", sessionId);
    if (error) return { success: false, error: error.message };
  }

  if (transitionedToTrue) {
    const { data: ctx } = await supabase
      .from("sessions")
      .select("goals!inner(user_id)")
      .eq("id", sessionId)
      .single();

    const goalsField = (ctx as { goals?: { user_id?: string } | { user_id?: string }[] | null } | null)?.goals;
    const studentId = Array.isArray(goalsField) ? goalsField[0]?.user_id : goalsField?.user_id;

    if (studentId) {
      const { count } = await supabase
        .from("insight_cards")
        .select("id", { count: "exact", head: true })
        .eq("session_id", sessionId)
        .eq("trainer_status", "approved");
      if ((count ?? 0) > 0) {
        await notifyNewInsights(studentId, sessionId, count ?? 0);
      }
    }
  }

  await maybeCompleteSessionCore(supabase, sessionId);

  return { success: true };
}

export async function createSessionForStudentCore(
  supabase: SupabaseClient,
  studentId: string,
  goalId: string,
  payload: {
    scheduledAt?: string | null;
    completedAt?: string | null;
    trainerNotes?: string | null;
    status?: "planned" | "completed";
  }
): Promise<CreateResult> {
  try {
    // Verify the goal belongs to this student
    const { data: goal } = await supabase
      .from("goals")
      .select("id, user_id")
      .eq("id", goalId)
      .single();
    if (!goal || goal.user_id !== studentId) {
      return { success: false, error: "Goal not found for student" };
    }

    // Next session number for this goal
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("goal_id", goalId);
    const sessionNumber = (count ?? 0) + 1;

    const status = payload.status ?? "planned";

    const insert: Record<string, unknown> = {
      goal_id: goalId,
      session_number: sessionNumber,
      status,
      trainer_notes: payload.trainerNotes?.trim() || null,
    };
    if (payload.scheduledAt) insert.scheduled_at = payload.scheduledAt;
    if (status === "completed") {
      insert.completed_at = payload.completedAt ?? new Date().toISOString();
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .insert(insert)
      .select("id")
      .single();

    if (error || !session) {
      return { success: false, error: error?.message ?? "Failed to create session" };
    }

    return { success: true, sessionId: session.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
