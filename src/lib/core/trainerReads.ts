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
