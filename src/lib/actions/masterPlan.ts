"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  createMasterPlanCore,
  addMasterPlanSectionCore,
  deleteMasterPlanSectionCore,
  addMasterPlanItemCore,
  deleteMasterPlanItemCore,
} from "@/lib/core/masterPlan";
import type { MasterPlan, MasterPlanCategory } from "@/lib/types";

type Result<T = void> =
  | (T extends void ? { success: true } : { success: true } & T)
  | { success: false; error: string };

async function requireTrainer() {
  const user = await getSession();
  if (!user || user.role !== "trainer")
    return { ok: false as const, error: "Not authorized" };
  const supabase = await createClient();
  return { ok: true as const, supabase, userId: user.id };
}

export async function getMasterPlan(studentId: string): Promise<MasterPlan | null> {
  const user = await getSession();
  if (!user) return null;
  if (user.role !== "trainer" && user.id !== studentId) return null;
  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("master_plans")
    .select("*")
    .eq("student_id", studentId)
    .single();
  if (!plan) return null;

  const { data: sections } = await supabase
    .from("master_plan_sections")
    .select("*, master_plan_items(*)")
    .eq("plan_id", plan.id)
    .order("sort_order");

  return {
    ...plan,
    sections: (sections ?? []).map((s: Record<string, unknown>) => ({
      ...(s as object),
      items: ((s.master_plan_items as unknown[]) ?? []),
    })),
  } as MasterPlan;
}

export async function createMasterPlan(
  studentId: string
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await createMasterPlanCore(auth.supabase, auth.userId, studentId);
  if (!result.success) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  return { success: true, id: result.id };
}

export async function addSection(
  planId: string,
  studentId: string,
  payload: { title: string; category: MasterPlanCategory; sortOrder?: number }
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await addMasterPlanSectionCore(auth.supabase, planId, payload);
  if (!result.success) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  return { success: true, id: result.id };
}

export async function deleteSection(
  sectionId: string,
  studentId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await deleteMasterPlanSectionCore(auth.supabase, sectionId);
  if (!result.success) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  return { success: true };
}

export async function addItem(
  sectionId: string,
  studentId: string,
  payload: { title: string; description?: string | null; imageUrl?: string | null; sortOrder?: number }
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await addMasterPlanItemCore(auth.supabase, sectionId, payload);
  if (!result.success) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath(`/masterplan`);
  return { success: true, id: result.id };
}

export async function deleteItem(
  itemId: string,
  studentId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const result = await deleteMasterPlanItemCore(auth.supabase, itemId);
  if (!result.success) return result;

  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath(`/masterplan`);
  return { success: true };
}
