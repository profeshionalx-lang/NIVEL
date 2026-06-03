import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Business core for skill-progress operations driven by the trainer. Auth-agnostic:
 * callers verify the user is a trainer and pass a ready `supabase` client. No
 * "use server", no revalidate. Wrapped by both web Server Actions and `/api/v1`.
 */

type Ok = { success: true };
type Err = { error: string };

/**
 * Adds `points` to the student's progress for the given skill. New skills get
 * points_seen = NULL (shows a NEW badge); existing skills snapshot the old value
 * into points_seen so the delta equals exactly the added amount.
 */
export async function addSkillToStudentCore(
  supabase: SupabaseClient,
  studentId: string,
  skillId: number,
  points: number
): Promise<Ok | Err> {
  if (points < 1 || points > 10) return { error: "Баллы должны быть от 1 до 10" };

  const { data: existing } = await supabase
    .from("skill_progress")
    .select("points")
    .eq("user_id", studentId)
    .eq("skill_id", skillId)
    .maybeSingle();

  let dbError;
  if (existing) {
    const { error } = await supabase
      .from("skill_progress")
      .update({ points: existing.points + points, points_seen: existing.points })
      .eq("user_id", studentId)
      .eq("skill_id", skillId);
    dbError = error;
  } else {
    const { error } = await supabase
      .from("skill_progress")
      .insert({ user_id: studentId, skill_id: skillId, points, points_seen: null });
    dbError = error;
  }

  if (dbError) return { error: dbError.message };
  return { success: true };
}

/**
 * Upserts a skill by russian/english name, then adds it to the student. Returns
 * the same shape as addSkillToStudentCore.
 */
export async function createAndAddSkillCore(
  supabase: SupabaseClient,
  studentId: string,
  nameRu: string,
  nameEn: string,
  points: number
): Promise<Ok | Err> {
  const trimmedRu = nameRu.trim();
  const trimmedEn = nameEn.trim() || trimmedRu;

  if (!trimmedRu) return { error: "Название обязательно" };
  if (trimmedRu.length > 40) return { error: "Название не более 40 символов" };

  // ON CONFLICT DO UPDATE SET name = EXCLUDED.name ensures RETURNING works even on conflict.
  const { data: skillRow, error: skillError } = await supabase
    .from("skills")
    .upsert(
      { name: trimmedRu, name_ru: trimmedRu, name_en: trimmedEn },
      { onConflict: "name" }
    )
    .select("id")
    .single();

  if (skillError || !skillRow) {
    return { error: skillError?.message ?? "Не удалось создать скил" };
  }

  return addSkillToStudentCore(supabase, studentId, skillRow.id, points);
}
