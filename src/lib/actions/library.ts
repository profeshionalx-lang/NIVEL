"use server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import type { Skill, Exercise } from "@/lib/types";
import {
  searchSkillsCore,
  searchExercisesCore,
  createSkillCore,
  createExerciseCore,
} from "@/lib/core/library";

/**
 * Thin Server Action wrappers around `src/lib/core/library.ts` — session check
 * + web-facing shape ({@link Skill}/{@link Exercise}, legacy `name` field), no
 * duplicated business logic. Wrapped by `/api/v1/skills` and `/api/v1/exercises`
 * (nivel-android#69 Stage 2, NIVEL#225) too.
 */

export async function searchSkills(
  query: string
): Promise<{ success: true; skills: Skill[] } | { success: false; error: string }> {
  const supabase = await createClient();
  const result = await searchSkillsCore(supabase, query);
  if (!result.success) return result;
  return { success: true, skills: result.items.map(toSkill) };
}

export async function searchExercises(
  query: string
): Promise<{ success: true; exercises: Exercise[] } | { success: false; error: string }> {
  const supabase = await createClient();
  const result = await searchExercisesCore(supabase, query);
  if (!result.success) return result;
  return { success: true, exercises: result.items.map(toExercise) };
}

export async function createSkill(
  name: string
): Promise<{ success: true; skill: Skill } | { success: false; error: string }> {
  const user = await getSession();
  if (!user || user.role !== "trainer") {
    return { success: false, error: "Only trainers can create skills" };
  }

  const supabase = await createClient();
  const result = await createSkillCore(supabase, name, "");
  if (!result.success) return result;

  const { data: skill, error } = await supabase
    .from("skills")
    .select("*")
    .eq("id", result.id)
    .single();
  if (error || !skill) return { success: false, error: error?.message ?? "Failed to create skill" };

  return { success: true, skill };
}

export async function createExercise(
  name: string
): Promise<{ success: true; exercise: Exercise } | { success: false; error: string }> {
  const user = await getSession();
  if (!user || user.role !== "trainer") {
    return { success: false, error: "Only trainers can create exercises" };
  }

  const supabase = await createClient();
  const result = await createExerciseCore(supabase, name, "");
  if (!result.success) return result;

  const { data: exercise, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", result.id)
    .single();
  if (error || !exercise) {
    return { success: false, error: error?.message ?? "Failed to create exercise" };
  }

  return { success: true, exercise };
}

function toSkill(item: { id: number; name_ru: string; created_at: string }): Skill {
  return { id: item.id, name: item.name_ru, created_at: item.created_at };
}

function toExercise(item: { id: number; name_ru: string; created_at: string }): Exercise {
  return { id: item.id, name: item.name_ru, created_at: item.created_at };
}
