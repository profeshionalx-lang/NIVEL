import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-side business core for trainer-facing data, consumed by `/api/v1`
 * (native client) and reusable by web. Auth-agnostic: callers verify the
 * trainer session and pass a ready `supabase` client. No "use server".
 *
 * NOTE: query shapes mirror the existing trainer web pages; verify against the
 * live DB when wiring the native screens (typecheck can't validate row shapes).
 */

export type StudentListItem = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  active_goals: number;
  total_sessions: number;
};

export async function listStudentsCore(
  supabase: SupabaseClient
): Promise<StudentListItem[]> {
  const { data: students } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  return Promise.all(
    (students ?? []).map(async (s: Record<string, unknown>) => {
      const id = s.id as string;
      const { count: goalCount } = await supabase
        .from("goals")
        .select("*", { count: "exact", head: true })
        .eq("user_id", id)
        .eq("status", "active");
      const { count: sessionCount } = await supabase
        .from("sessions")
        .select("*, goals!inner(user_id)", { count: "exact", head: true })
        .eq("goals.user_id", id);
      return {
        id,
        email: (s.email as string | null) ?? null,
        full_name: (s.full_name as string | null) ?? null,
        avatar_url: (s.avatar_url as string | null) ?? null,
        active_goals: goalCount ?? 0,
        total_sessions: sessionCount ?? 0,
      };
    })
  );
}

export type StudentDetail = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  goals: Array<{
    id: string;
    custom_problem: string | null;
    status: string;
    created_at: string;
  }>;
  sessions: Array<{
    id: string;
    goal_id: string;
    session_number: number | null;
    status: string;
    scheduled_at: string | null;
    completed_at: string | null;
    created_at: string;
  }>;
};

export async function getStudentDetailCore(
  supabase: SupabaseClient,
  studentId: string
): Promise<StudentDetail | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url, role")
    .eq("id", studentId)
    .maybeSingle();
  if (!profile || (profile as { role: string }).role !== "student") return null;

  const { data: goals } = await supabase
    .from("goals")
    .select("id, custom_problem, status, created_at")
    .eq("user_id", studentId)
    .order("created_at", { ascending: false });

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, goal_id, session_number, status, scheduled_at, completed_at, created_at, goals!inner(user_id)")
    .eq("goals.user_id", studentId)
    .order("created_at", { ascending: false });

  const p = profile as Record<string, unknown>;
  return {
    id: p.id as string,
    email: (p.email as string | null) ?? null,
    full_name: (p.full_name as string | null) ?? null,
    avatar_url: (p.avatar_url as string | null) ?? null,
    goals: (goals ?? []).map((g: Record<string, unknown>) => ({
      id: g.id as string,
      custom_problem: (g.custom_problem as string | null) ?? null,
      status: g.status as string,
      created_at: g.created_at as string,
    })),
    sessions: (sessions ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      goal_id: s.goal_id as string,
      session_number: (s.session_number as number | null) ?? null,
      status: s.status as string,
      scheduled_at: (s.scheduled_at as string | null) ?? null,
      completed_at: (s.completed_at as string | null) ?? null,
      created_at: s.created_at as string,
    })),
  };
}

export type SessionDetail = {
  id: string;
  goal_id: string;
  session_number: number | null;
  status: string;
  trainer_notes: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  exercises: Array<{ id: number; name: string | null; sort_order: number | null }>;
};

export async function getSessionDetailCore(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionDetail | null> {
  const { data: session } = await supabase
    .from("sessions")
    .select("id, goal_id, session_number, status, trainer_notes, scheduled_at, completed_at")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return null;

  const { data: exercises } = await supabase
    .from("session_exercises")
    .select("id, sort_order, exercises(name)")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  const s = session as Record<string, unknown>;
  return {
    id: s.id as string,
    goal_id: s.goal_id as string,
    session_number: (s.session_number as number | null) ?? null,
    status: s.status as string,
    trainer_notes: (s.trainer_notes as string | null) ?? null,
    scheduled_at: (s.scheduled_at as string | null) ?? null,
    completed_at: (s.completed_at as string | null) ?? null,
    exercises: (exercises ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as number,
      name: ((e.exercises as { name?: string } | null)?.name as string | null) ?? null,
      sort_order: (e.sort_order as number | null) ?? null,
    })),
  };
}

export type SessionInsightCard = {
  id: string;
  title: string | null;
  body: string | null;
  quote: string | null;
  tags: string[] | null;
  front_text: string | null;
  context_text: string | null;
  source: string | null;
  trainer_status: string | null;
  student_decision: string | null;
  position: number | null;
  created_at: string;
};

export async function getSessionInsightCardsCore(
  supabase: SupabaseClient,
  sessionId: string
): Promise<SessionInsightCard[]> {
  const { data } = await supabase
    .from("insight_cards")
    .select(
      "id, title, body, quote, tags, front_text, context_text, source, trainer_status, student_decision, position, created_at"
    )
    .eq("session_id", sessionId)
    .order("position", { ascending: true });
  return (data ?? []).map((c: Record<string, unknown>) => ({
    id: c.id as string,
    title: (c.title as string | null) ?? null,
    body: (c.body as string | null) ?? null,
    quote: (c.quote as string | null) ?? null,
    tags: (c.tags as string[] | null) ?? null,
    front_text: (c.front_text as string | null) ?? null,
    context_text: (c.context_text as string | null) ?? null,
    source: (c.source as string | null) ?? null,
    trainer_status: (c.trainer_status as string | null) ?? null,
    student_decision: (c.student_decision as string | null) ?? null,
    position: (c.position as number | null) ?? null,
    created_at: c.created_at as string,
  }));
}

export type ReferenceData = {
  problem_categories: Array<{ id: number; name: string; sort_order: number | null }>;
  problems: Array<{ id: number; category_id: number; name: string; sort_order: number | null }>;
  skills: Array<{ id: number; name: string }>;
  exercises: Array<{ id: number; name: string }>;
};

/**
 * Reference dictionaries shown when the trainer composes goals / sessions /
 * insight cards: problem categories + problems, skills, exercises.
 *
 * Localized fields use name_ru / name_en (mirrors goals/new and the trainer
 * student page). `exercises` only has a single `name` column, so it is not
 * localized.
 */
export async function getReferenceCore(
  supabase: SupabaseClient,
  lang: "ru" | "en"
): Promise<ReferenceData> {
  const nameCol = lang === "en" ? "name_en" : "name_ru";

  const [catsRes, probsRes, skillsRes, exercisesRes] = await Promise.all([
    supabase
      .from("problem_categories")
      .select(`id, sort_order, ${nameCol}`)
      .order("sort_order"),
    supabase
      .from("problems")
      .select(`id, category_id, sort_order, ${nameCol}`)
      .order("sort_order"),
    supabase.from("skills").select(`id, ${nameCol}`).order(nameCol),
    supabase.from("exercises").select("id, name").order("name"),
  ]);

  return {
    problem_categories: (catsRes.data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as number,
      name: (c[nameCol] as string | null) ?? "",
      sort_order: (c.sort_order as number | null) ?? null,
    })),
    problems: (probsRes.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as number,
      category_id: p.category_id as number,
      name: (p[nameCol] as string | null) ?? "",
      sort_order: (p.sort_order as number | null) ?? null,
    })),
    skills: (skillsRes.data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as number,
      name: (s[nameCol] as string | null) ?? "",
    })),
    exercises: (exercisesRes.data ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as number,
      name: (e.name as string | null) ?? "",
    })),
  };
}

export type MasterPlanData = {
  id: string;
  student_id: string;
  trainer_id: string;
  created_at: string;
  updated_at: string;
  sections: Array<{
    id: string;
    plan_id: string;
    title: string;
    category: string;
    sort_order: number;
    items: Array<{
      id: string;
      section_id: string;
      title: string;
      description: string | null;
      image_url: string | null;
      sort_order: number;
    }>;
  }>;
};

/**
 * The student's master plan with its sections and items (mirrors getMasterPlan
 * in actions/masterPlan.ts). Returns null when the student has no plan yet.
 * Sections and items are returned ordered by sort_order for a stable DTO.
 */
export async function getMasterPlanCore(
  supabase: SupabaseClient,
  studentId: string
): Promise<MasterPlanData | null> {
  const { data: plan } = await supabase
    .from("master_plans")
    .select("id, student_id, trainer_id, created_at, updated_at")
    .eq("student_id", studentId)
    .maybeSingle();
  if (!plan) return null;

  const planRow = plan as Record<string, unknown>;
  const { data: sections } = await supabase
    .from("master_plan_sections")
    .select(
      "id, plan_id, title, category, sort_order, master_plan_items(id, section_id, title, description, image_url, sort_order)"
    )
    .eq("plan_id", planRow.id as string)
    .order("sort_order");

  return {
    id: planRow.id as string,
    student_id: planRow.student_id as string,
    trainer_id: planRow.trainer_id as string,
    created_at: planRow.created_at as string,
    updated_at: planRow.updated_at as string,
    sections: (sections ?? []).map((s: Record<string, unknown>) => ({
      id: s.id as string,
      plan_id: s.plan_id as string,
      title: s.title as string,
      category: s.category as string,
      sort_order: (s.sort_order as number | null) ?? 0,
      items: (((s.master_plan_items as Record<string, unknown>[]) ?? [])
        .map((it) => ({
          id: it.id as string,
          section_id: it.section_id as string,
          title: it.title as string,
          description: (it.description as string | null) ?? null,
          image_url: (it.image_url as string | null) ?? null,
          sort_order: (it.sort_order as number | null) ?? 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order)),
    })),
  };
}
