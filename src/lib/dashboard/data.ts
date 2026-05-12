// src/lib/dashboard/data.ts
import { createClient } from "@/lib/supabase/server";
import { calculateSkillLevel } from "@/lib/types";
import { getMasterPlan } from "@/lib/actions/masterPlan";
import type { Locale } from "@/lib/i18n";
import type { MasterPlan } from "@/lib/types";

export interface DashboardGoal {
  id: string;
  custom_problem: string | null;
  status: string;
  session_count: number;
  created_at: string;
  problems: { id: number; name: string; category_name: string }[];
  total_sessions: number;
  completed_sessions: number;
}

export interface DashboardSkill {
  skill_id: number;
  skill_name: string;
  points: number;
  level: number;
  points_in_level: number;
}

export interface DashboardSession {
  id: string;
  session_number: number;
  status: string;
  created_at: string;
  pending: number;
}

export interface DashboardNextSession {
  id: string;
  session_number: number;
  scheduled_at: string | null;
  exercises: string[];
}

export interface DashboardProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface DashboardData {
  profile: DashboardProfile;
  goals: DashboardGoal[];
  skillProgress: DashboardSkill[];
  sessions: DashboardSession[];
  nextSession: DashboardNextSession | null;
  masterPlan: MasterPlan | null;
  totalPendingCards: number;
  firstPendingSessionId: string | null;
}

export async function loadDashboardData(
  userId: string,
  locale: Locale
): Promise<DashboardData | null> {
  const supabase = await createClient();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id, email, full_name, avatar_url")
    .eq("id", userId)
    .single();
  if (!profileRow) return null;

  const nameCol = locale === "en" ? "name_en" : "name_ru";

  const { data: goalsRaw } = await supabase
    .from("goals")
    .select(
      `*, goal_problems(problem_id, problems(id, ${nameCol}, problem_categories(${nameCol})))`
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const goals: DashboardGoal[] = await Promise.all(
    (goalsRaw || []).map(async (goal: Record<string, unknown>) => {
      const { count } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("goal_id", goal.id as string);

      const completedCount = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("goal_id", goal.id as string)
        .eq("status", "completed");

      const goalProblems = (goal.goal_problems as Array<Record<string, unknown>>) || [];
      const problems = goalProblems.map((gp) => {
        const prob = gp.problems as Record<string, unknown>;
        const cat = prob?.problem_categories as Record<string, unknown>;
        return {
          id: prob?.id as number,
          name: (prob?.[nameCol] as string) ?? "",
          category_name: (cat?.[nameCol] as string) || "",
        };
      });

      return {
        id: goal.id as string,
        custom_problem: (goal.custom_problem as string) || null,
        status: goal.status as string,
        session_count: (goal.session_count as number) ?? 0,
        created_at: goal.created_at as string,
        problems,
        total_sessions: count || 0,
        completed_sessions: completedCount.count || 0,
      };
    })
  );

  const { data: skillProgressRaw } = await supabase
    .from("skill_progress")
    .select(`*, skills(${nameCol})`)
    .eq("user_id", userId)
    .order("points", { ascending: false });

  const skillProgress: DashboardSkill[] = (skillProgressRaw || []).map(
    (sp: Record<string, unknown>) => {
      const skill = sp.skills as Record<string, unknown>;
      const points = sp.points as number;
      const { level, points_in_level } = calculateSkillLevel(points);
      return {
        skill_id: sp.skill_id as number,
        skill_name: (skill?.[nameCol] as string) || "",
        points,
        level,
        points_in_level,
      };
    }
  );

  const { data: sessionsRaw } = await supabase
    .from("sessions")
    .select("*, goals!inner(user_id)")
    .eq("goals.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: pendingByCard } = await supabase
    .from("insight_cards")
    .select("session_id")
    .eq("student_id", userId)
    .eq("trainer_status", "approved")
    .is("student_decision", null);

  const pendingCounts = new Map<string, number>();
  (pendingByCard ?? []).forEach((row: { session_id: string }) => {
    const sid = row.session_id;
    pendingCounts.set(sid, (pendingCounts.get(sid) ?? 0) + 1);
  });

  const sessions: DashboardSession[] = (sessionsRaw ?? []).map(
    (s: Record<string, unknown>) => ({
      id: s.id as string,
      session_number: s.session_number as number,
      status: s.status as string,
      created_at: s.created_at as string,
      pending: pendingCounts.get(s.id as string) ?? 0,
    })
  );

  const totalPendingCards = sessions.reduce((sum, s) => sum + s.pending, 0);
  const firstPendingSessionId = sessions.find((s) => s.pending > 0)?.id ?? null;

  const { data: nextSessionRaw } = await supabase
    .from("sessions")
    .select(
      `*, goals!inner(user_id), session_exercises(id, exercises(${nameCol}))`
    )
    .eq("goals.user_id", userId)
    .eq("status", "planned")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const nextSessionRow = nextSessionRaw as Record<string, unknown> | null;
  const nextSession: DashboardNextSession | null = nextSessionRow
    ? {
        id: nextSessionRow.id as string,
        session_number: nextSessionRow.session_number as number,
        scheduled_at: (nextSessionRow.scheduled_at as string) ?? null,
        exercises: ((nextSessionRow.session_exercises as Array<Record<string, unknown>>) || [])
          .map((se) => (se.exercises as Record<string, unknown>)?.[nameCol] as string)
          .filter(Boolean),
      }
    : null;

  const masterPlan = await getMasterPlan(userId);

  return {
    profile: {
      id: profileRow.id as string,
      email: (profileRow.email as string) ?? null,
      full_name: (profileRow.full_name as string) ?? null,
      avatar_url: (profileRow.avatar_url as string) ?? null,
    },
    goals,
    skillProgress,
    sessions,
    nextSession,
    masterPlan,
    totalPendingCards,
    firstPendingSessionId,
  };
}
