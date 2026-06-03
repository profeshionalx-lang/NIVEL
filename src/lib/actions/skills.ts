"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import {
  addSkillToStudentCore,
  createAndAddSkillCore,
} from "@/lib/core/skills";

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

  const supabase = await createClient();
  const result = await addSkillToStudentCore(supabase, studentId, skillId, points);
  if ("error" in result) return result;

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

  const supabase = await createClient();
  const result = await createAndAddSkillCore(supabase, studentId, nameRu, nameEn, points);
  if ("error" in result) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath("/dashboard");
  return { success: true };
}
