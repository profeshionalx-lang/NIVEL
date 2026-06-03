import type { SupabaseClient } from "@supabase/supabase-js";
import type { MasterPlanCategory } from "@/lib/types";

/**
 * Business core for master-plan operations (plan, sections, items). Auth-agnostic:
 * callers verify the user is a trainer and pass a ready `supabase` client plus the
 * trainer id. No "use server", no revalidate. Wrapped by both web Server Actions
 * and `/api/v1`.
 */

type Ok<T = object> = { success: true } & T;
type Err = { success: false; error: string };

/**
 * Verifies a master-plan section belongs to the given student's plan. Used by
 * `/api/v1` to confirm the trainer (already verified to own the student) is not
 * mutating another student's section via id-guessing.
 */
export async function sectionBelongsToStudent(
  supabase: SupabaseClient,
  sectionId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("master_plan_sections")
    .select("id, master_plans!inner(student_id)")
    .eq("id", sectionId)
    .maybeSingle();
  if (!data) return false;
  const plan = (data as unknown as { master_plans: { student_id: string } }).master_plans;
  return plan?.student_id === studentId;
}

/** Verifies a master-plan item belongs to the given student's plan. */
export async function itemBelongsToStudent(
  supabase: SupabaseClient,
  itemId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("master_plan_items")
    .select("id, master_plan_sections!inner(master_plans!inner(student_id))")
    .eq("id", itemId)
    .maybeSingle();
  if (!data) return false;
  const section = (
    data as unknown as { master_plan_sections: { master_plans: { student_id: string } } }
  ).master_plan_sections;
  return section?.master_plans?.student_id === studentId;
}

/** Verifies a master plan belongs to the given student. */
export async function planBelongsToStudent(
  supabase: SupabaseClient,
  planId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("master_plans")
    .select("id")
    .eq("id", planId)
    .eq("student_id", studentId)
    .maybeSingle();
  return !!data;
}

export async function createMasterPlanCore(
  supabase: SupabaseClient,
  trainerId: string,
  studentId: string
): Promise<Ok<{ id: string }> | Err> {
  const { data, error } = await supabase
    .from("master_plans")
    .insert({ student_id: studentId, trainer_id: trainerId })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  return { success: true, id: data.id };
}

export async function addMasterPlanSectionCore(
  supabase: SupabaseClient,
  planId: string,
  payload: { title: string; category: MasterPlanCategory; sortOrder?: number }
): Promise<Ok<{ id: string }> | Err> {
  const { data, error } = await supabase
    .from("master_plan_sections")
    .insert({
      plan_id: planId,
      title: payload.title.trim(),
      category: payload.category,
      sort_order: payload.sortOrder ?? 0,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  return { success: true, id: data.id };
}

export async function deleteMasterPlanSectionCore(
  supabase: SupabaseClient,
  sectionId: string
): Promise<Ok | Err> {
  const { error } = await supabase
    .from("master_plan_sections")
    .delete()
    .eq("id", sectionId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function addMasterPlanItemCore(
  supabase: SupabaseClient,
  sectionId: string,
  payload: {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
  }
): Promise<Ok<{ id: string }> | Err> {
  const { data, error } = await supabase
    .from("master_plan_items")
    .insert({
      section_id: sectionId,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      image_url: payload.imageUrl?.trim() || null,
      sort_order: payload.sortOrder ?? 0,
    })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  return { success: true, id: data.id };
}

export async function deleteMasterPlanItemCore(
  supabase: SupabaseClient,
  itemId: string
): Promise<Ok | Err> {
  const { error } = await supabase
    .from("master_plan_items")
    .delete()
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
