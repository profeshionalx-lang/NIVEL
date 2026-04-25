"use server";

import { createClient } from "@/lib/supabase/server";
import { DEMO_USER } from "@/lib/supabase/demoUser";
import type { Skill, Exercise } from "@/lib/types";

export async function searchSkills(
  query: string
): Promise<{ success: true; skills: Skill[] } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { data: skills, error } = await supabase
      .from("skills")
      .select("*")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, skills: skills ?? [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function searchExercises(
  query: string
): Promise<{ success: true; exercises: Exercise[] } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    const { data: exercises, error } = await supabase
      .from("exercises")
      .select("*")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, exercises: exercises ?? [] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function createSkill(
  name: string
): Promise<{ success: true; skill: Skill } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    // Verify trainer role
    const user = DEMO_USER;
const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "trainer") {
      return { success: false, error: "Only trainers can create skills" };
    }

    const { data: skill, error: insertError } = await supabase
      .from("skills")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: true })
      .select("*")
      .single();

    if (insertError || !skill) {
      // If upsert with ignoreDuplicates returns no row, fetch existing
      const { data: existing, error: fetchError } = await supabase
        .from("skills")
        .select("*")
        .ilike("name", name)
        .single();

      if (fetchError || !existing) {
        return {
          success: false,
          error: insertError?.message ?? fetchError?.message ?? "Failed to create skill",
        };
      }

      return { success: true, skill: existing };
    }

    return { success: true, skill };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

export async function createExercise(
  name: string
): Promise<{ success: true; exercise: Exercise } | { success: false; error: string }> {
  try {
    const supabase = await createClient();

    // Verify trainer role
    const user = DEMO_USER;
const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "trainer") {
      return { success: false, error: "Only trainers can create exercises" };
    }

    const { data: exercise, error: insertError } = await supabase
      .from("exercises")
      .upsert({ name }, { onConflict: "name", ignoreDuplicates: true })
      .select("*")
      .single();

    if (insertError || !exercise) {
      // If upsert with ignoreDuplicates returns no row, fetch existing
      const { data: existing, error: fetchError } = await supabase
        .from("exercises")
        .select("*")
        .ilike("name", name)
        .single();

      if (fetchError || !existing) {
        return {
          success: false,
          error:
            insertError?.message ?? fetchError?.message ?? "Failed to create exercise",
        };
      }

      return { success: true, exercise: existing };
    }

    return { success: true, exercise };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
