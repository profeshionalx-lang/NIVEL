// src/lib/dashboard/data.ts
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateSkillLevel } from "@/lib/types";
import { getMasterPlan } from "@/lib/actions/masterPlan";
import { syncUserMatches } from "@/lib/playtomic/sync";
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
}

export interface DashboardProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  playtomic_user_id: string | null;
}

export interface DashboardMatch {
  id: string;
  start_date: string;
  location: string | null;
  resource_name: string | null;
  status: string | null;
  teams: unknown;
  goalsCount: number;
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
  upcomingMatches: DashboardMatch[];
}

export async function loadDashboardData(
  userId: string,
  locale: Locale
): Promise<DashboardData | null> {
  const supabase = await createClient();
  const nameCol = locale === "en" ? "name_en" : "name_ru";
  const UPCOMING_STATUSES = ["PENDING", "CONFIRMED"];
  const nowIso = new Date().toISOString();

  // Fire-and-forget Playtomic sync (cooldown enforced). Don't block the page.
  after(() => syncUserMatches(userId));

  // Stage 1: 8 independent queries in parallel (single round-trip on the wire).
  const [
    profileRes,
    goalsRes,
    skillProgressRes,
    sessionsRes,
    pendingByCardRes,
    nextSessionRes,
    masterPlan,
    matchesRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, playtomic_user_id")
      .eq("id", userId)
      .single(),
    supabase
      .from("goals")
      .select(
        `*, goal_problems(problem_id, problems(id, ${nameCol}, problem_categories(${nameCol})))`
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("skill_progress")
      .select(`*, skills(${nameCol})`)
      .eq("user_id", userId)
      .order("points", { ascending: false }),
    supabase
      .from("sessions")
      .select("*, goals!inner(user_id)")
      .eq("goals.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("insight_cards")
      .select("session_id")
      .eq("student_id", userId)
      .eq("trainer_status", "approved")
      .is("student_decision", null),
    supabase
      .from("sessions")
      .select("*, goals!inner(user_id)")
      .eq("goals.user_id", userId)
      .eq("status", "planned")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    getMasterPlan(userId),
    supabase
      .from("matches")
      .select(
        `id, start_date, location, resource_name, status, teams, match_goals(count)`
      )
      .eq("profile_id", userId)
      .in("status", UPCOMING_STATUSES)
      .gte("start_date", nowIso)
      .order("start_date", { ascending: true })
      .limit(5),
  ]);

  const profileRow = profileRes.data;
  if (!profileRow) return null;

  const goalsRaw = goalsRes.data;
  const skillProgressRaw = skillProgressRes.data;
  const sessionsRaw = sessionsRes.data;
  const pendingByCard = pendingByCardRes.data;
  const nextSessionRaw = nextSessionRes.data;
  const matchesRaw = matchesRes.data;

  // Stage 2: one extra query for per-goal session counts (replaces N×2 loop).
  const goalIds = (goalsRaw ?? []).map((g: Record<string, unknown>) => g.id as string);
  const { data: goalSessions } = goalIds.length > 0
    ? await supabase
        .from("sessions")
        .select("goal_id, status")
        .in("goal_id", goalIds)
    : { data: [] as Array<{ goal_id: string; status: string }> };

  const totalByGoal = new Map<string, number>();
  const completedByGoal = new Map<string, number>();
  for (const s of (goalSessions ?? []) as Array<{ goal_id: string; status: string }>) {
    totalByGoal.set(s.goal_id, (totalByGoal.get(s.goal_id) ?? 0) + 1);
    if (s.status === "completed") {
      completedByGoal.set(s.goal_id, (completedByGoal.get(s.goal_id) ?? 0) + 1);
    }
  }

  const goals: DashboardGoal[] = (goalsRaw ?? []).map((goal: Record<string, unknown>) => {
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

    const id = goal.id as string;
    return {
      id,
      custom_problem: (goal.custom_problem as string) || null,
      status: goal.status as string,
      session_count: (goal.session_count as number) ?? 0,
      created_at: goal.created_at as string,
      problems,
      total_sessions: totalByGoal.get(id) ?? 0,
      completed_sessions: completedByGoal.get(id) ?? 0,
    };
  });

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

  const nextSessionRow = nextSessionRaw as Record<string, unknown> | null;
  const nextSession: DashboardNextSession | null = nextSessionRow
    ? {
        id: nextSessionRow.id as string,
        session_number: nextSessionRow.session_number as number,
        scheduled_at: (nextSessionRow.scheduled_at as string) ?? null,
      }
    : null;

  const upcomingMatches: DashboardMatch[] = (matchesRaw ?? []).map(
    (r: {
      id: string;
      start_date: string;
      location: string | null;
      resource_name: string | null;
      status: string | null;
      teams: unknown;
      match_goals: Array<{ count: number }>;
    }) => ({
      id: r.id,
      start_date: r.start_date,
      location: r.location,
      resource_name: r.resource_name,
      status: r.status,
      teams: r.teams,
      goalsCount: r.match_goals?.[0]?.count ?? 0,
    })
  );

  return {
    profile: {
      id: profileRow.id as string,
      email: (profileRow.email as string) ?? null,
      full_name: (profileRow.full_name as string) ?? null,
      avatar_url: (profileRow.avatar_url as string) ?? null,
      playtomic_user_id: (profileRow.playtomic_user_id as string) ?? null,
    },
    goals,
    skillProgress,
    sessions,
    nextSession,
    masterPlan,
    totalPendingCards,
    firstPendingSessionId,
    upcomingMatches,
  };
}
