"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";

async function requireTrainer() {
  const session = await getSession();
  if (!session) throw new Error("unauthorized");
  if (session.role !== "trainer") throw new Error("forbidden");
  return session;
}

export async function addSkillToStudent(
  studentId: string,
  skillId: number,
  points: number
): Promise<{ success: true } | { error: string }> {
  try {
    await requireTrainer();
  } catch {
    return { error: "Forbidden" };
  }

  if (points < 1 || points > 10) return { error: "Баллы должны быть от 1 до 10" };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("skill_progress")
    .select("points")
    .eq("user_id", studentId)
    .eq("skill_id", skillId)
    .maybeSingle();

  let dbError;
  if (existing) {
    // Add to existing: points_seen = old points so delta = exactly N added
    const { error } = await supabase
      .from("skill_progress")
      .update({ points: existing.points + points, points_seen: existing.points })
      .eq("user_id", studentId)
      .eq("skill_id", skillId);
    dbError = error;
  } else {
    // New skill: points_seen = NULL → shows as NEW badge
    const { error } = await supabase
      .from("skill_progress")
      .insert({ user_id: studentId, skill_id: skillId, points, points_seen: null });
    dbError = error;
  }

  if (dbError) return { error: dbError.message };

  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function createAndAddSkill(
  studentId: string,
  nameRu: string,
  nameEn: string,
  points: number
): Promise<{ success: true } | { error: string }> {
  try {
    await requireTrainer();
  } catch {
    return { error: "Forbidden" };
  }

  const trimmedRu = nameRu.trim();
  const trimmedEn = nameEn.trim() || trimmedRu;

  if (!trimmedRu) return { error: "Название обязательно" };
  if (trimmedRu.length > 40) return { error: "Название не более 40 символов" };

  const supabase = await createClient();

  // ON CONFLICT DO UPDATE SET name = EXCLUDED.name ensures RETURNING works even on conflict
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

  return addSkillToStudent(studentId, skillRow.id, points);
}
