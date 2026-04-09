export type UserRole = "student" | "trainer";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface ProblemCategory {
  id: number;
  name: string;
  sort_order: number;
}

export interface Problem {
  id: number;
  category_id: number;
  name: string;
  sort_order: number;
}

export interface ProblemWithCategory extends Problem {
  category: ProblemCategory;
}

export interface Skill {
  id: number;
  name: string;
  created_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  custom_problem: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
}

export interface GoalProblem {
  goal_id: string;
  problem_id: number;
}

export interface GoalWithDetails extends Goal {
  problems: { id: number; name: string; category_name: string }[];
  completed_sessions: number;
}

export interface Session {
  id: string;
  goal_id: string;
  session_number: number;
  trainer_notes: string | null;
  student_insight: string | null;
  status: "planned" | "completed";
  completed_at: string | null;
  created_at: string;
}

export interface SessionExercise {
  id: number;
  session_id: string;
  exercise_id: number;
  sort_order: number;
}

export interface SessionExerciseSkill {
  session_exercise_id: number;
  skill_id: number;
}

export interface SkillProgress {
  id: number;
  user_id: string;
  skill_id: number;
  points: number;
}

export interface SkillProgressDisplay {
  skill_id: number;
  skill_name: string;
  points: number;
  level: number;
  points_in_level: number;
}

export interface SessionDetail {
  id: string;
  session_number: number;
  goal_id: string;
  exercises: {
    id: number;
    name: string;
    skills: { id: number; name: string }[];
  }[];
  trainer_notes: string | null;
  student_insight: string | null;
  status: "planned" | "completed";
  completed_at: string | null;
  created_at: string;
}

export function calculateSkillLevel(points: number): {
  level: number;
  points_in_level: number;
} {
  const level = Math.min(5, Math.floor(points / 10) + 1);
  const points_in_level = points >= 50 ? 10 : points % 10;
  return { level, points_in_level };
}
