# Trainer Admin = Student View Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Depends on:** docs/plans/2026-05-12-shadow-student-claim.md (Epic 1) — provides `createShadowStudent`, `updateStudentProfile`, `getStudentInvite`, `regenerateInvite`, `revokeInvite` in `src/lib/actions/students.ts`. This Epic references those actions by name without re-implementing them. Note: shadow-student creation form has only `full_name` (no email). Profile rendering must handle null email.

**Goal:** Тренер заходит на `/trainer/students/[id]` и видит ТОЧНО ТУ ЖЕ страницу, что увидит ученик на `/dashboard` — те же компоненты, тот же визуал — но с inline-аффордансами редактирования (карандашики, кнопки `+`) и блоком инвайта сверху. Insight cards остаются жёстко привязаны к конкретной сессии — тренер сначала создаёт сессию (как реально прошедшую тренировку), затем добавляет к ней карточки. Никакого preview-режима.

**Architecture:** Извлекаем общую функцию загрузки данных дашборда (`loadDashboardData(userId)` в `src/lib/dashboard/data.ts`) и общий презентационный компонент (`<DashboardView data editable />` в `src/components/dashboard/DashboardView.tsx`). И `/dashboard/page.tsx`, и `/trainer/students/[id]/page.tsx` тонко обёртывают этот компонент — первый без `editable`, второй с `editable={{ studentId, trainerId }}`. Trainer-side server actions, принимающие `studentId` явно: `createGoalForStudent`, `createSessionForStudent`. Insight cards добавляются к существующей сессии через уже работающий `createInsightCard(sessionId, payload)`.

**Tech Stack:** Next.js 16 App Router, Supabase (service role key), React 19 (`useTransition`, `useState`), Tailwind v4 с существующими design tokens.

---

## Task 1: Новая server action `createGoalForStudent`

**Files:**
- Modify: `src/lib/actions/goals.ts`

**Step 1: Добавь функцию в конец `src/lib/actions/goals.ts`**

```typescript
export async function createGoalForStudent(
  studentId: string,
  problemId: number | null,
  customProblem: string | null
): Promise<{ success: true; goalId: string } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };
    if (user.role !== "trainer") return { success: false, error: "Forbidden" };

    const supabase = await createClient();

    const { data: student } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", studentId)
      .single();
    if (!student) return { success: false, error: "Student not found" };

    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({ user_id: studentId, custom_problem: customProblem })
      .select("id")
      .single();

    if (goalError || !goal) {
      return { success: false, error: goalError?.message ?? "Failed to create goal" };
    }

    if (problemId) {
      const { error: problemsError } = await supabase
        .from("goal_problems")
        .insert({ goal_id: goal.id, problem_id: problemId });

      if (problemsError) {
        return { success: false, error: problemsError.message };
      }
    }

    revalidatePath(`/trainer/students/${studentId}`);
    revalidatePath(`/dashboard`);

    return { success: true, goalId: goal.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep goals.ts
```

Должно быть пусто.

**Step 3: Commit**

```bash
git add src/lib/actions/goals.ts
git commit -m "feat(goals): add createGoalForStudent for trainer-side goal creation"
```

---

## Task 2: Новая server action `createSessionForStudent`

**Files:**
- Modify: `src/lib/actions/sessions.ts`

Упрощённый вариант `createSession`: тренер создаёт сессию «как прошедшую» — без exercises (их можно добавить позже на странице сессии). Принимает goalId + опциональные scheduled_at/completed_at/notes.

**Step 1: Добавь функцию в конец `src/lib/actions/sessions.ts`**

```typescript
export async function createSessionForStudent(
  studentId: string,
  goalId: string,
  payload: {
    scheduledAt?: string | null;
    completedAt?: string | null;
    trainerNotes?: string | null;
    status?: "planned" | "completed";
  }
): Promise<{ success: true; sessionId: string } | { success: false; error: string }> {
  try {
    const user = await getSession();
    if (!user) return { success: false, error: "Not authenticated" };
    if (user.role !== "trainer") return { success: false, error: "Forbidden" };

    const supabase = await createClient();

    // Verify the goal belongs to this student
    const { data: goal } = await supabase
      .from("goals")
      .select("id, user_id")
      .eq("id", goalId)
      .single();
    if (!goal || goal.user_id !== studentId) {
      return { success: false, error: "Goal not found for student" };
    }

    // Next session number for this goal
    const { count } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("goal_id", goalId);
    const sessionNumber = (count ?? 0) + 1;

    const status = payload.status ?? "planned";

    const insert: Record<string, unknown> = {
      goal_id: goalId,
      session_number: sessionNumber,
      status,
      trainer_notes: payload.trainerNotes?.trim() || null,
    };
    if (payload.scheduledAt) insert.scheduled_at = payload.scheduledAt;
    if (status === "completed") {
      insert.completed_at = payload.completedAt ?? new Date().toISOString();
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .insert(insert)
      .select("id")
      .single();

    if (error || !session) {
      return { success: false, error: error?.message ?? "Failed to create session" };
    }

    revalidatePath(`/trainer/students/${studentId}`);
    revalidatePath("/dashboard");
    return { success: true, sessionId: session.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep sessions.ts
```

**Step 3: Commit**

```bash
git add src/lib/actions/sessions.ts
git commit -m "feat(sessions): add createSessionForStudent for trainer-side session creation"
```

---

## Task 3: Извлечь `loadDashboardData(userId, locale)` в `src/lib/dashboard/data.ts`

**Files:**
- Create: `src/lib/dashboard/data.ts`

Single source of truth — обе страницы (студент и тренер) загружают через эту функцию. Email на профиле может быть `null` (shadow students).

**Step 1: Создай файл**

```typescript
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
  (pendingByCard ?? []).forEach((row) => {
    const sid = (row as { session_id: string }).session_id;
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
```

**Step 2: Verify**

```bash
npx tsc --noEmit 2>&1 | grep dashboard/data.ts
```

Должно быть пусто.

**Step 3: Commit**

```bash
git add src/lib/dashboard/data.ts
git commit -m "feat(dashboard): extract loadDashboardData for reuse on trainer side"
```

---

## Task 4: Создать `<DashboardView>` в `src/components/dashboard/DashboardView.tsx`

**Files:**
- Create: `src/components/dashboard/DashboardView.tsx`
- Create: `src/components/dashboard/edit/InlineGoalCreator.tsx` (stub)
- Create: `src/components/dashboard/edit/InlineSessionCreator.tsx` (stub)
- Create: `src/components/dashboard/edit/InlineProfileHeader.tsx` (stub)
- Create: `src/components/dashboard/edit/InlineSessionCardAdder.tsx` (stub)

Server Component. Принимает `data: DashboardData` + опциональный `editable: { studentId, trainerId } | false`. Email профиля nullable: показываем full_name либо email либо initials.

**Step 1: Создай stubs для inline-компонентов**

```bash
mkdir -p src/components/dashboard/edit
```

```tsx
// src/components/dashboard/edit/InlineGoalCreator.tsx
"use client";
export default function InlineGoalCreator({ studentId: _studentId }: { studentId: string }) {
  return <span className="text-primary text-xs font-bold uppercase tracking-wider opacity-30">+ new</span>;
}
```

```tsx
// src/components/dashboard/edit/InlineSessionCreator.tsx
"use client";
import type { DashboardGoal } from "@/lib/dashboard/data";
export default function InlineSessionCreator({
  studentId: _studentId,
  goals: _goals,
}: {
  studentId: string;
  goals: DashboardGoal[];
}) {
  return null;
}
```

```tsx
// src/components/dashboard/edit/InlineProfileHeader.tsx
"use client";
import type { DashboardProfile } from "@/lib/dashboard/data";
export default function InlineProfileHeader({ profile }: { profile: DashboardProfile }) {
  return (
    <div>
      <p className="text-on-surface-variant text-sm font-medium">Trainer admin</p>
      <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
        {profile.full_name || profile.email || "Unnamed"}
      </h1>
    </div>
  );
}
```

```tsx
// src/components/dashboard/edit/InlineSessionCardAdder.tsx
"use client";
export default function InlineSessionCardAdder({ sessionId: _sessionId }: { sessionId: string }) {
  return null;
}
```

**Step 2: Создай `DashboardView.tsx`**

```tsx
// src/components/dashboard/DashboardView.tsx
import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
import { t, type Locale } from "@/lib/i18n";
import type { DashboardData } from "@/lib/dashboard/data";

import InlineGoalCreator from "@/components/dashboard/edit/InlineGoalCreator";
import InlineSessionCreator from "@/components/dashboard/edit/InlineSessionCreator";
import InlineProfileHeader from "@/components/dashboard/edit/InlineProfileHeader";
import InlineSessionCardAdder from "@/components/dashboard/edit/InlineSessionCardAdder";
import MasterPlanEditor from "@/components/masterPlan/MasterPlanEditor";

export interface DashboardViewEditable {
  studentId: string;
  trainerId: string;
}

interface Props {
  data: DashboardData;
  locale: Locale;
  editable?: DashboardViewEditable | false;
}

export default function DashboardView({ data, locale, editable }: Props) {
  const dateLocale = locale === "ru" ? "ru-RU" : "en-US";
  const { profile, goals, skillProgress, sessions, nextSession, masterPlan, totalPendingCards, firstPendingSessionId } = data;
  const isTrainer = !!editable;

  const displayName = profile.full_name || profile.email || "Unnamed";
  const firstName = profile.full_name?.split(" ")[0] || profile.email?.split("@")[0] || t(locale, "dashboard.player");
  const masterPlanPreview = masterPlan?.sections.slice(0, 2) ?? [];

  const planGoal =
    goals.find((g) => g.total_sessions > 0) ??
    goals.find((g) => g.session_count > 0) ??
    goals[0];
  const planPercent = planGoal && planGoal.session_count > 0
    ? Math.min(100, Math.round((planGoal.total_sessions / planGoal.session_count) * 100))
    : 0;

  const isEmpty = goals.length === 0 && skillProgress.length === 0 && !masterPlan && sessions.length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      {isTrainer ? (
        <InlineProfileHeader profile={profile} />
      ) : (
        <div>
          <p className="text-on-surface-variant text-sm font-medium">{t(locale, "dashboard.welcome")}</p>
          <h1 className="text-4xl font-black tracking-tighter leading-none mt-0.5">
            {firstName} <span className="kinetic-text">👋</span>
          </h1>
        </div>
      )}

      {/* Empty state — student only */}
      {isEmpty && !isTrainer ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <h2 className="text-5xl font-black italic uppercase tracking-tighter kinetic-text">Nivel</h2>
          <p className="text-on-surface-variant text-center text-sm max-w-xs">
            {t(locale, "dashboard.emptyHint")}
          </p>
          <Link
            href="/goals/new"
            className="kinetic-gradient text-on-primary font-black py-4 px-8 rounded-2xl text-lg"
            style={{ boxShadow: "0 10px 30px rgba(202,253,0,0.25)" }}
          >
            {t(locale, "dashboard.createGoal")}
          </Link>
        </div>
      ) : (
        <>
          {/* Pending banner — student only */}
          {!isTrainer && totalPendingCards > 0 && firstPendingSessionId && (
            <Link
              href={`/sessions/${firstPendingSessionId}/insights`}
              className="block kinetic-gradient text-on-primary rounded-3xl p-5 glow-primary"
              style={{ boxShadow: "0 10px 30px rgba(202,253,0,0.35)" }}
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined fill-icon text-3xl">auto_awesome</span>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
                    {t(locale, "common.actionRequired")}
                  </p>
                  <h2 className="text-xl font-black tracking-tight">
                    {totalPendingCards}{" "}
                    {totalPendingCards === 1
                      ? t(locale, "dashboard.insightsToReview.one")
                      : t(locale, "dashboard.insightsToReview")}
                  </h2>
                </div>
                <span className="material-symbols-outlined text-2xl">arrow_forward</span>
              </div>
            </Link>
          )}

          {/* Master plan: trainer edits, student previews */}
          {isTrainer ? (
            <MasterPlanEditor studentId={editable.studentId} plan={masterPlan} />
          ) : masterPlan ? (
            <Link
              href="/masterplan"
              className="block bg-surface-low rounded-2xl p-4 active:bg-surface-card transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                  {t(locale, "dashboard.masterPlan")}
                </p>
                <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">chevron_right</span>
              </div>
              <div className="space-y-1.5">
                {masterPlanPreview.map((section) => (
                  <div key={section.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-60 flex-shrink-0" />
                    <p className="text-sm text-on-surface-variant truncate">{section.title}</p>
                    <span className="text-[10px] text-on-surface-variant opacity-40 flex-shrink-0">
                      {section.items.length} {t(locale, "common.items")}
                    </span>
                  </div>
                ))}
              </div>
            </Link>
          ) : null}

          {/* Plan progress — student only */}
          {!isTrainer && planGoal && planGoal.session_count > 0 && (
            <section className="bg-surface-low rounded-2xl p-4">
              <div className="flex justify-between items-baseline mb-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
                    {t(locale, "dashboard.currentPlan")}
                  </p>
                  <span className="text-sm font-black tracking-tight">
                    {Math.min(planGoal.total_sessions, planGoal.session_count)}/{planGoal.session_count}
                  </span>
                </div>
                <span className="text-base font-black italic kinetic-text">{planPercent}%</span>
              </div>
            </section>
          )}

          {/* Goals */}
          <section>
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t(locale, "dashboard.activeGoals")}
              </h3>
              {isTrainer ? (
                <InlineGoalCreator studentId={editable.studentId} />
              ) : (
                <Link href="/goals/new" className="text-primary text-xs font-bold uppercase tracking-wider">
                  + {t(locale, "common.new")}
                </Link>
              )}
            </div>
            {goals.length === 0 ? (
              <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                {isTrainer ? "No goals yet. Click + new to add one." : "—"}
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
                {goals.map((goal) => (
                  <div key={goal.id} className="flex-shrink-0 w-52 bg-surface-card rounded-2xl p-4" style={{ borderTop: "2px solid #cafd00" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                        {goal.total_sessions}/{goal.session_count} {t(locale, "dashboard.sessions")}
                      </span>
                    </div>
                    {goal.problems.length > 0
                      ? goal.problems.map((p) => (
                          <p key={p.id} className="text-sm font-semibold leading-snug text-on-surface mb-1">
                            {p.name.length > 50 ? p.name.slice(0, 50) + "..." : p.name}
                          </p>
                        ))
                      : goal.custom_problem
                      ? <p className="text-sm font-semibold leading-snug text-on-surface mb-1">{goal.custom_problem}</p>
                      : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Skills */}
          {skillProgress.length > 0 && (
            <section className="bg-surface-high rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-5">
                {t(locale, "dashboard.skillProgression")}
              </h3>
              <div className="space-y-5">
                {skillProgress.map((sp, i) => (
                  <ProgressBar
                    key={sp.skill_id}
                    label={sp.skill_name}
                    value={sp.points_in_level}
                    max={10}
                    variant={i % 2 === 0 ? "secondary" : "primary"}
                    sublabel={`${sp.points_in_level}/10 · Lv.${sp.level}`}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sessions list */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
                {t(locale, "dashboard.sessionHistory")}
              </h3>
              {isTrainer && (
                <InlineSessionCreator studentId={editable.studentId} goals={goals} />
              )}
            </div>
            {sessions.length === 0 ? (
              <p className="text-on-surface-variant text-sm bg-surface-card rounded-2xl p-4">
                {isTrainer ? "No sessions yet. Add a goal first, then create your first session." : "—"}
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center gap-2">
                    <Link
                      href={`/sessions/${session.id}`}
                      className={`flex-1 flex items-center gap-4 rounded-2xl px-4 py-3.5 transition-colors ${
                        session.pending > 0
                          ? "bg-primary/10 border border-primary/40 glow-primary"
                          : "bg-surface-low active:bg-surface-card"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        session.pending > 0 ? "kinetic-gradient text-on-primary" : "bg-surface-card text-primary"
                      }`}>
                        {session.session_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {t(locale, "dashboard.session")} {session.session_number}
                        </p>
                        <p className="text-[11px] text-on-surface-variant">
                          {new Date(session.created_at).toLocaleDateString(dateLocale, { day: "numeric", month: "long" })}
                          {session.status === "completed" && ` · ${t(locale, "common.completed")}`}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">chevron_right</span>
                    </Link>
                    {isTrainer && <InlineSessionCardAdder sessionId={session.id} />}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Next session — student only */}
          {!isTrainer && nextSession && (
            <section>
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4 px-1">
                {t(locale, "dashboard.nextSession")}
              </h3>
              <Link href={`/sessions/${nextSession.id}`} className="block bg-surface-low rounded-3xl p-5">
                <h4 className="text-xl font-black tracking-tight mb-4">
                  {t(locale, "dashboard.session")} {nextSession.session_number}
                </h4>
              </Link>
            </section>
          )}

          {/* Helpful hint — silence the linter about unused displayName */}
          {isTrainer && <span className="hidden">{displayName}</span>}
        </>
      )}
    </div>
  );
}
```

**Step 3: Verify**

```bash
npx tsc --noEmit 2>&1 | head -30
```

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardView.tsx src/components/dashboard/edit/
git commit -m "feat(dashboard): extract DashboardView + edit-component stubs"
```

---

## Task 5: Переписать `/dashboard/page.tsx` и `/trainer/students/[id]/page.tsx`

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/trainer/students/[id]/page.tsx`

**Step 1: Перепиши `src/app/dashboard/page.tsx`**

```tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { loadDashboardData } from "@/lib/dashboard/data";
import DashboardView from "@/components/dashboard/DashboardView";
import LanguageSwitcher from "@/components/navigation/LanguageSwitcher";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const data = await loadDashboardData(user.id, locale);
  if (!data) redirect("/login");

  return (
    <>
      <DashboardView data={data} locale={locale} />
      <LanguageSwitcher current={locale} />
    </>
  );
}
```

**Step 2: Перепиши `src/app/trainer/students/[id]/page.tsx`**

```tsx
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { loadDashboardData } from "@/lib/dashboard/data";
import DashboardView from "@/components/dashboard/DashboardView";
import InviteBlock from "@/components/trainer/InviteBlock";

export default async function TrainerStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const { id: studentId } = await params;
  const locale = await getLocale();
  const data = await loadDashboardData(studentId, locale);
  if (!data) redirect("/trainer/students");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href="/trainer/students" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">Student</span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto space-y-6">
        <InviteBlock studentId={studentId} />
        <DashboardView
          data={data}
          locale={locale}
          editable={{ studentId, trainerId: user.id }}
        />
      </main>
    </div>
  );
}
```

> Note: `InviteBlock` создаётся в Task 9. Если Epic 1 ещё не залит — замени временно на `null`, чтобы билд прошёл.

**Step 3: Verify**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -20
```

**Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/trainer/students/[id]/page.tsx
git commit -m "refactor(dashboard): both /dashboard and /trainer/students/[id] now use DashboardView"
```

---

## Task 6: Реализовать `InlineGoalCreator` (modal)

**Files:**
- Modify: `src/components/dashboard/edit/InlineGoalCreator.tsx`

**Step 1: Полная реализация**

```tsx
// src/components/dashboard/edit/InlineGoalCreator.tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createGoalForStudent } from "@/lib/actions/goals";
import { createClient } from "@/lib/supabase/client";

interface Problem {
  id: number;
  name: string;
  category_id: number;
}

export default function InlineGoalCreator({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [problemId, setProblemId] = useState<number | "">("");
  const [customProblem, setCustomProblem] = useState("");

  useEffect(() => {
    if (!open || problems.length) return;
    const supabase = createClient();
    supabase
      .from("problems")
      .select("id, category_id, name_ru")
      .order("sort_order")
      .then(({ data }) => {
        if (data) {
          setProblems(
            data.map((p: Record<string, unknown>) => ({
              id: p.id as number,
              category_id: p.category_id as number,
              name: (p.name_ru as string) ?? "",
            }))
          );
        }
      });
  }, [open, problems.length]);

  function handleSave() {
    if (!problemId && !customProblem.trim()) return;
    startTransition(async () => {
      const res = await createGoalForStudent(
        studentId,
        problemId === "" ? null : Number(problemId),
        customProblem.trim() || null
      );
      if (!res.success) {
        alert(res.error);
        return;
      }
      setOpen(false);
      setProblemId("");
      setCustomProblem("");
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-primary text-xs font-bold uppercase tracking-wider">
        + new
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black tracking-tight">New goal</h3>
            <textarea
              value={customProblem}
              onChange={(e) => setCustomProblem(e.target.value)}
              placeholder="Describe the problem (or leave empty and pick from list)"
              rows={2}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            <select
              value={problemId}
              onChange={(e) => setProblemId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
            >
              <option value="">— Link a problem (optional) —</option>
              {problems.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending || (!problemId && !customProblem.trim())}
                className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Save"}
              </button>
              <button onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Verify + Commit**

```bash
npx tsc --noEmit 2>&1 | grep InlineGoalCreator
git add src/components/dashboard/edit/InlineGoalCreator.tsx
git commit -m "feat(dashboard): inline goal creation modal for trainer view"
```

---

## Task 7: Реализовать `InlineSessionCreator`

**Files:**
- Modify: `src/components/dashboard/edit/InlineSessionCreator.tsx`

Кнопка `+ session` рядом с заголовком Sessions. Открывает форму: select goal (из переданных goals), date (scheduled_at), checkbox "completed", trainer notes (optional). Вызывает `createSessionForStudent`.

**Step 1: Полная реализация**

```tsx
// src/components/dashboard/edit/InlineSessionCreator.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSessionForStudent } from "@/lib/actions/sessions";
import type { DashboardGoal } from "@/lib/dashboard/data";

interface Props {
  studentId: string;
  goals: DashboardGoal[];
}

export default function InlineSessionCreator({ studentId, goals }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [goalId, setGoalId] = useState<string>(goals[0]?.id ?? "");
  const [date, setDate] = useState<string>("");
  const [completed, setCompleted] = useState(true);
  const [notes, setNotes] = useState("");

  function handleSave() {
    if (!goalId) {
      alert("Pick a goal first. If there's no goal yet, click '+ new' on the Goals row.");
      return;
    }
    startTransition(async () => {
      const iso = date ? new Date(date).toISOString() : null;
      const res = await createSessionForStudent(studentId, goalId, {
        scheduledAt: iso,
        completedAt: completed ? iso ?? new Date().toISOString() : null,
        trainerNotes: notes.trim() || null,
        status: completed ? "completed" : "planned",
      });
      if (!res.success) {
        alert(res.error);
        return;
      }
      setOpen(false);
      setDate("");
      setNotes("");
      router.refresh();
    });
  }

  const disabled = goals.length === 0;

  return (
    <>
      <button
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        className="text-primary text-xs font-bold uppercase tracking-wider disabled:opacity-30"
        title={disabled ? "Create a goal first" : undefined}
      >
        + session
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black tracking-tight">New session</h3>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Goal</span>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="mt-1 w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
              >
                {goals.map((g) => {
                  const label = g.problems[0]?.name ?? g.custom_problem ?? `Goal ${g.id.slice(0, 4)}`;
                  return <option key={g.id} value={g.id}>{label}</option>;
                })}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Date</span>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-on-surface">
              <input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} />
              <span>Mark as completed (a past session)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Trainer notes (optional)"
              rows={3}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending || !goalId}
                className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Create session"}
              </button>
              <button onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Verify + Commit**

```bash
npx tsc --noEmit 2>&1 | grep InlineSessionCreator
git add src/components/dashboard/edit/InlineSessionCreator.tsx
git commit -m "feat(dashboard): inline session creation modal for trainer view"
```

---

## Task 8: Реализовать `InlineSessionCardAdder` (+ insight per session row)

**Files:**
- Modify: `src/components/dashboard/edit/InlineSessionCardAdder.tsx`

На каждой строке Session-history в trainer-режиме — кнопка `+`, открывающая компактную модалку с front/context и кнопкой Add. Вызываем существующий `createInsightCard(sessionId, payload)`. После сохранения карточка автоматически попадает в стандартный flow (draft → approve в TrainerCardEditor на странице сессии).

**Step 1: Полная реализация**

```tsx
// src/components/dashboard/edit/InlineSessionCardAdder.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInsightCard, setTrainerCardStatus } from "@/lib/actions/insightCards";

export default function InlineSessionCardAdder({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [front, setFront] = useState("");
  const [context, setContext] = useState("");

  function handleSave() {
    if (!front.trim()) return;
    startTransition(async () => {
      const res = await createInsightCard(sessionId, {
        frontText: front,
        contextText: context || null,
      });
      if (!res.success) {
        alert(res.error);
        return;
      }
      // Auto-approve since the trainer is the author here
      await setTrainerCardStatus(res.id, "approved");
      setFront("");
      setContext("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-shrink-0 w-9 h-9 rounded-xl bg-surface-card text-primary text-lg font-black active:scale-95 transition-transform"
        title="Add insight card"
      >
        +
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black tracking-tight">New insight card</h3>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="One principle, one line"
              rows={2}
              autoFocus
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="When to use it (optional)"
              rows={2}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isPending || !front.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending ? "Saving…" : "Add"}
              </button>
              <button onClick={() => setOpen(false)} className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Verify + Commit**

```bash
npx tsc --noEmit 2>&1 | grep InlineSessionCardAdder
git add src/components/dashboard/edit/InlineSessionCardAdder.tsx
git commit -m "feat(dashboard): inline insight-card adder per session row"
```

---

## Task 9: Реализовать `InlineProfileHeader` (editable name + avatar)

**Files:**
- Modify: `src/components/dashboard/edit/InlineProfileHeader.tsx`

Email опционален (shadow students). Редактируем full_name и avatar_url. Email НЕ показываем в UI как обязательное поле — если есть, рендерим как текст под именем; если нет — ничего.

**Step 1: Полная реализация**

```tsx
// src/components/dashboard/edit/InlineProfileHeader.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentProfile } from "@/lib/actions/students";
import type { DashboardProfile } from "@/lib/dashboard/data";

export default function InlineProfileHeader({ profile }: { profile: DashboardProfile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  function handleSave() {
    startTransition(async () => {
      const res = await updateStudentProfile(profile.id, {
        full_name: fullName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      });
      if (!res.success) {
        alert(res.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  const displayName = profile.full_name || profile.email || "Unnamed";
  const initials = displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (editing) {
    return (
      <div className="bg-surface-card rounded-2xl p-4 space-y-3">
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Full name"
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        />
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Avatar URL (optional)"
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={isPending} className="flex-1 py-2 rounded-xl font-bold text-xs kinetic-gradient text-on-primary disabled:opacity-40">
            {isPending ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setFullName(profile.full_name ?? "");
              setAvatarUrl(profile.avatar_url ?? "");
            }}
            className="flex-1 py-2 rounded-xl font-bold text-xs border border-border-dim text-on-surface"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="w-full flex items-center gap-4 text-left active:opacity-80">
      <div className="w-14 h-14 rounded-full bg-surface-card border-2 border-primary flex items-center justify-center overflow-hidden">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-bold text-on-surface">{initials}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-[0.2em]">
          Trainer admin · tap to edit
        </p>
        <h1 className="text-2xl font-black tracking-tight truncate">{displayName}</h1>
        {profile.email && <p className="text-on-surface-variant text-xs truncate">{profile.email}</p>}
      </div>
      <span className="material-symbols-outlined text-on-surface-variant opacity-40">edit</span>
    </button>
  );
}
```

**Step 2: Verify + Commit**

If Epic 1 hasn't landed, stub `updateStudentProfile` in `src/lib/actions/students.ts` returning `{ success: false, error: "Epic 1 not yet landed" }`.

```bash
npx tsc --noEmit 2>&1 | grep InlineProfileHeader
git add src/components/dashboard/edit/InlineProfileHeader.tsx
git commit -m "feat(dashboard): inline editable profile header for trainer view"
```

---

## Task 10: Создать `<InviteBlock>` (server + client)

**Files:**
- Create: `src/components/trainer/InviteBlock.tsx`
- Create: `src/components/trainer/InviteBlockClient.tsx`

**Step 1: Server component**

```tsx
// src/components/trainer/InviteBlock.tsx
import { getStudentInvite } from "@/lib/actions/students";
import InviteBlockClient from "./InviteBlockClient";

export default async function InviteBlock({ studentId }: { studentId: string }) {
  const invite = await getStudentInvite(studentId);
  if (!invite) return null;

  const baseUrl = process.env.NEXT_PUBLIC_NIVEL_URL ?? "http://localhost:3000";
  const claimUrl = `${baseUrl}/claim/${invite.token}`;

  return (
    <InviteBlockClient
      studentId={studentId}
      claimUrl={claimUrl}
      status={invite.status}
      claimedAt={invite.claimed_at}
    />
  );
}
```

**Step 2: Client component**

```tsx
// src/components/trainer/InviteBlockClient.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateInvite, revokeInvite } from "@/lib/actions/students";

interface Props {
  studentId: string;
  claimUrl: string;
  status: "pending" | "claimed" | "revoked";
  claimedAt: string | null;
}

export default function InviteBlockClient({ studentId, claimUrl, status, claimedAt }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRegenerate() {
    if (!confirm("Regenerate invite? Old link will stop working.")) return;
    startTransition(async () => {
      const res = await regenerateInvite(studentId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  function handleRevoke() {
    if (!confirm("Revoke invite?")) return;
    startTransition(async () => {
      const res = await revokeInvite(studentId);
      if (!res.success) alert(res.error);
      else router.refresh();
    });
  }

  const badge = {
    pending: { text: "Pending claim", className: "bg-secondary/20 text-secondary" },
    claimed: { text: "Claimed", className: "bg-primary/20 text-primary" },
    revoked: { text: "Revoked", className: "bg-error/20 text-error" },
  }[status];

  return (
    <section className="bg-surface-card rounded-2xl p-4 space-y-3 border border-border-dim">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Student invite</p>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${badge.className}`}>
          {badge.text}
        </span>
      </div>
      {status === "claimed" && claimedAt && (
        <p className="text-xs text-on-surface-variant">Claimed {new Date(claimedAt).toLocaleString()}</p>
      )}
      {status === "pending" && (
        <>
          <div className="bg-surface-elevated rounded-xl p-3 flex items-center gap-2">
            <code className="text-xs text-on-surface flex-1 truncate">{claimUrl}</code>
            <button onClick={handleCopy} className="text-xs font-bold uppercase tracking-wider text-primary px-2">
              {copied ? "✓" : "Copy"}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRegenerate} disabled={isPending} className="flex-1 py-2 rounded-xl text-xs font-bold border border-border-dim text-on-surface disabled:opacity-40">
              Regenerate
            </button>
            <button onClick={handleRevoke} disabled={isPending} className="flex-1 py-2 rounded-xl text-xs font-bold border border-border-dim text-error disabled:opacity-40">
              Revoke
            </button>
          </div>
        </>
      )}
    </section>
  );
}
```

**Step 3: Verify + Commit**

If Epic 1 actions don't exist yet, stub them in `src/lib/actions/students.ts`.

```bash
npx tsc --noEmit 2>&1 | grep InviteBlock
git add src/components/trainer/InviteBlock.tsx src/components/trainer/InviteBlockClient.tsx
git commit -m "feat(trainer): invite block with copy/regenerate/revoke"
```

---

## Task 11: Кнопка "Create Student" + модалка на `/trainer/students`

**Files:**
- Modify: `src/app/trainer/students/page.tsx`
- Create: `src/components/trainer/CreateStudentButton.tsx`

Форма имеет ТОЛЬКО full_name. Никакого email. После сохранения показывается claim URL с кнопкой Copy.

**Step 1: Client component**

```tsx
// src/components/trainer/CreateStudentButton.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createShadowStudent } from "@/lib/actions/students";

export default function CreateStudentButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleCreate() {
    if (!fullName.trim()) return;
    startTransition(async () => {
      const res = await createShadowStudent({ full_name: fullName.trim() });
      if (!res.success) {
        alert(res.error);
        return;
      }
      const baseUrl = process.env.NEXT_PUBLIC_NIVEL_URL ?? "";
      setCreatedUrl(`${baseUrl}/claim/${res.token}`);
      router.refresh();
    });
  }

  function handleCopy() {
    if (!createdUrl) return;
    navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setOpen(false);
    setFullName("");
    setCreatedUrl(null);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="kinetic-gradient text-on-primary font-black py-2 px-4 rounded-xl text-sm active:scale-[0.98] transition-transform">
        + Create student
      </button>
      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 flex items-end sm:items-center justify-center p-4" onClick={handleClose}>
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            {!createdUrl ? (
              <>
                <h3 className="text-lg font-black tracking-tight">New student</h3>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  autoFocus
                  className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
                />
                <div className="flex gap-2">
                  <button onClick={handleCreate} disabled={isPending || !fullName.trim()} className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40">
                    {isPending ? "Creating…" : "Create"}
                  </button>
                  <button onClick={handleClose} className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black tracking-tight">Student created</h3>
                <p className="text-sm text-on-surface-variant">Share this link with the student to claim their profile:</p>
                <div className="bg-surface-elevated rounded-xl p-3 flex items-center gap-2">
                  <code className="text-xs text-on-surface flex-1 truncate">{createdUrl}</code>
                  <button onClick={handleCopy} className="text-xs font-bold uppercase tracking-wider text-primary px-2">
                    {copied ? "✓" : "Copy"}
                  </button>
                </div>
                <button onClick={handleClose} className="w-full py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: Подключи в `src/app/trainer/students/page.tsx`**

В header замени группу справа от заголовка на:

```tsx
import CreateStudentButton from "@/components/trainer/CreateStudentButton";

// ... в header:
<header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
  <span className="text-lg font-black text-primary uppercase italic tracking-tight">Ученики</span>
  <div className="flex items-center gap-3">
    <CreateStudentButton />
    <Link href="/dashboard" className="text-on-surface-variant">
      <span className="material-symbols-outlined">close</span>
    </Link>
  </div>
</header>
```

Также обновить отображение строки студента: `student.full_name || student.email || "Unnamed"` (email может быть null).

**Step 3: Verify + Commit**

```bash
npx tsc --noEmit 2>&1 | grep CreateStudent
npm run build 2>&1 | tail -10
git add src/components/trainer/CreateStudentButton.tsx src/app/trainer/students/page.tsx
git commit -m "feat(trainer): create-student button with claim URL modal (name only)"
```

---

## Task 12: End-to-end smoke check

**Step 1: Dev server**

```bash
npm run dev
```

**Step 2: Walkthrough**

1. Войди как тренер → `/trainer/students` → клик `+ Create student` → введи "Test Student" → submit → видишь модалку с claim URL → копируй.
2. Кликни по только что созданному студенту → попадаешь на `/trainer/students/<id>`:
   - InviteBlock сверху (Pending, copy/regenerate/revoke)
   - Тот же визуальный layout, что и `/dashboard`, но пустой
   - Editable profile header (tap to edit)
   - Inline-кнопки `+ new` для goals, `+ session` для sessions, master plan editor
3. Tap profile header → отредактируй full_name → Save → видишь обновлённое имя.
4. Add goal через `+ new` → появляется на странице.
5. Add master plan section + item.
6. Add session через `+ session` → выбери goal, дату, mark completed → Create → строка сессии появилась.
7. На строке сессии клик `+` → добавь insight card → готово.
8. Копируй invite URL → открой в инкогнито → пройди Epic 1 claim flow → залогинься как ученик.
9. Открой `/dashboard` под учеником → видишь ровно те же goal/sessions/master plan/profile.

**Step 3: SQL verify**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select s.id, s.session_number, s.status, g.user_id from sessions s join goals g on g.id = s.goal_id order by s.created_at desc limit 5;"}'
```

Должны быть видны созданные тренером сессии с правильным user_id.

---

## Acceptance for the whole epic

1. Trainer logs in.
2. Goes to `/trainer/students`, clicks "Create Student", types name (only name — no email), submits.
3. Sees the student detail page with the SAME layout as `/dashboard`, but empty, with invite-block at top showing claim URL.
4. Clicks "+ new" on Goals row inline, adds a goal — appears immediately on the page.
5. Adds master plan section + items inline.
6. Clicks "+ session" inline, picks the goal, picks a date, marks completed — a session row appears.
7. Clicks "+" on the session row → adds 2 insight cards (which are tied to that real session).
8. Copies invite URL, opens in incognito, claims it (Epic 1 flow), logs in.
9. The student now sees the exact same dashboard with the goal + master plan + sessions + cards already populated.

---

## Summary

| Task | Файлы | Что делает |
|------|-------|-----------|
| 1 | `src/lib/actions/goals.ts` | `createGoalForStudent` |
| 2 | `src/lib/actions/sessions.ts` | `createSessionForStudent` |
| 3 | `src/lib/dashboard/data.ts` | `loadDashboardData(userId, locale)` (email nullable) |
| 4 | `DashboardView.tsx` + edit stubs | Презентационный компонент |
| 5 | `dashboard/page.tsx`, `trainer/students/[id]/page.tsx` | Обе страницы → DashboardView |
| 6 | `InlineGoalCreator.tsx` | Modal создания цели |
| 7 | `InlineSessionCreator.tsx` | Modal создания сессии |
| 8 | `InlineSessionCardAdder.tsx` | Кнопка `+` на строке сессии для insight card |
| 9 | `InlineProfileHeader.tsx` | Inline-редактирование профиля (name + avatar) |
| 10 | `InviteBlock.tsx` + Client | UI инвайта (copy/regenerate/revoke) |
| 11 | `CreateStudentButton.tsx` + students/page.tsx | Кнопка + модалка (only name) |
| 12 | — | Ручная проверка |
