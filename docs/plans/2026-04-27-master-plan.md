# Master Plan Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Добавить «мастер-план» в профиль каждого ученика — структурированный диагностический документ с разбором ошибок и фотографиями, который тренер создаёт один раз в начале работы.

**Architecture:** Три новых таблицы Supabase (`master_plans`, `master_plan_sections`, `master_plan_items`). Тренер редактирует мастер-план на странице `/trainer/students/[id]` — новая секция внизу. Студент видит мастер-план в read-only на `/dashboard` (превью) и на `/masterplan` (полная страница). Все компоненты — Server Components, интерактивные части — отдельные Client Components с `"use client"`.

**Tech Stack:** Next.js 16 App Router, Supabase (service role key), Server Actions по паттерну `insightCards.ts`, Tailwind CSS v4 с существующими design tokens.

---

## Task 1: Миграция базы данных — 3 новые таблицы

**Files:**
- Create: `supabase/migrations/007_master_plan.sql`

**Step 1: Создай файл миграции**

```sql
-- supabase/migrations/007_master_plan.sql

create table master_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  trainer_id uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id)
);

create table master_plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references master_plans(id) on delete cascade,
  title text not null,
  category text not null check (category in ('strength','technique','tactics','custom')),
  sort_order int not null default 0
);

create table master_plan_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references master_plan_sections(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  sort_order int not null default 0
);
```

**Step 2: Примени миграцию через Supabase Management API**

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{
  "query": "create table if not exists master_plans (id uuid primary key default gen_random_uuid(), student_id uuid not null references profiles(id) on delete cascade, trainer_id uuid not null references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now(), unique(student_id)); create table if not exists master_plan_sections (id uuid primary key default gen_random_uuid(), plan_id uuid not null references master_plans(id) on delete cascade, title text not null, category text not null check (category in ('strength','technique','tactics','custom')), sort_order int not null default 0); create table if not exists master_plan_items (id uuid primary key default gen_random_uuid(), section_id uuid not null references master_plan_sections(id) on delete cascade, title text not null, description text, image_url text, sort_order int not null default 0);"
}
EOF
```

Ожидаемый ответ: `{"results": [...]}` без ошибок.

**Step 3: Commit**

```bash
git add supabase/migrations/007_master_plan.sql
git commit -m "chore: add master_plans migration"
```

---

## Task 2: TypeScript типы

**Files:**
- Modify: `src/lib/types/index.ts`

**Step 1: Добавь типы в конец файла**

```typescript
export type MasterPlanCategory = "strength" | "technique" | "tactics" | "custom";

export interface MasterPlanItem {
  id: string;
  section_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface MasterPlanSection {
  id: string;
  plan_id: string;
  title: string;
  category: MasterPlanCategory;
  sort_order: number;
  items: MasterPlanItem[];
}

export interface MasterPlan {
  id: string;
  student_id: string;
  trainer_id: string;
  created_at: string;
  updated_at: string;
  sections: MasterPlanSection[];
}
```

**Step 2: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add MasterPlan types"
```

---

## Task 3: Server Actions — CRUD для мастер-плана

**Files:**
- Create: `src/lib/actions/masterPlan.ts`

**Step 1: Создай файл с actions**

Паттерн идентичен `src/lib/actions/insightCards.ts` — `"use server"`, `requireTrainer()`, `Result<T>`, `revalidatePath`.

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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

  const { data, error } = await auth.supabase
    .from("master_plans")
    .insert({ student_id: studentId, trainer_id: auth.userId })
    .select("id")
    .single();

  if (error || !data) return { success: false, error: error?.message ?? "Failed" };
  revalidatePath(`/trainer/students/${studentId}`);
  return { success: true, id: data.id };
}

export async function addSection(
  planId: string,
  studentId: string,
  payload: { title: string; category: MasterPlanCategory; sortOrder?: number }
): Promise<Result<{ id: string }>> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { data, error } = await auth.supabase
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
  revalidatePath(`/trainer/students/${studentId}`);
  return { success: true, id: data.id };
}

export async function deleteSection(
  sectionId: string,
  studentId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("master_plan_sections")
    .delete()
    .eq("id", sectionId);

  if (error) return { success: false, error: error.message };
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

  const { data, error } = await auth.supabase
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
  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath(`/masterplan`);
  return { success: true, id: data.id };
}

export async function deleteItem(
  itemId: string,
  studentId: string
): Promise<Result> {
  const auth = await requireTrainer();
  if (!auth.ok) return { success: false, error: auth.error };

  const { error } = await auth.supabase
    .from("master_plan_items")
    .delete()
    .eq("id", itemId);

  if (error) return { success: false, error: error.message };
  revalidatePath(`/trainer/students/${studentId}`);
  revalidatePath(`/masterplan`);
  return { success: true };
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/masterPlan.ts
git commit -m "feat: add masterPlan server actions (CRUD)"
```

---

## Task 4: Секция мастер-плана на странице тренера

Страница `/trainer/students/[id]` — Server Component. Добавляем:
1. Запрос `getMasterPlan(studentId)` рядом с остальными запросами
2. Client Component `MasterPlanEditor` внизу страницы

**Files:**
- Create: `src/components/masterPlan/MasterPlanEditor.tsx`
- Modify: `src/app/trainer/students/[id]/page.tsx`

**Step 1: Создай Client Component `MasterPlanEditor`**

```typescript
// src/components/masterPlan/MasterPlanEditor.tsx
"use client";

import { useTransition, useState } from "react";
import { createMasterPlan, addSection, addItem, deleteSection, deleteItem } from "@/lib/actions/masterPlan";
import type { MasterPlan, MasterPlanCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<MasterPlanCategory, string> = {
  strength: "Strengths",
  technique: "Technique",
  tactics: "Tactics",
  custom: "Other",
};

const CATEGORY_COLORS: Record<MasterPlanCategory, string> = {
  strength: "#cafd00",
  technique: "#00f4fe",
  tactics: "#ff7351",
  custom: "#888",
};

interface Props {
  studentId: string;
  plan: MasterPlan | null;
}

export default function MasterPlanEditor({ studentId, plan: initialPlan }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [isPending, startTransition] = useTransition();
  const [addingSectionTo, setAddingSectionTo] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionCategory, setNewSectionCategory] = useState<MasterPlanCategory>("technique");
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemImage, setNewItemImage] = useState("");

  function handleCreatePlan() {
    startTransition(async () => {
      const res = await createMasterPlan(studentId);
      if (res.success) {
        setPlan({ id: res.id, student_id: studentId, trainer_id: "", created_at: "", updated_at: "", sections: [] });
      }
    });
  }

  function handleAddSection(planId: string) {
    if (!newSectionTitle.trim()) return;
    startTransition(async () => {
      const res = await addSection(planId, studentId, {
        title: newSectionTitle,
        category: newSectionCategory,
        sortOrder: (plan?.sections.length ?? 0),
      });
      if (res.success) {
        setPlan((prev) => prev ? {
          ...prev,
          sections: [...prev.sections, { id: res.id, plan_id: planId, title: newSectionTitle, category: newSectionCategory, sort_order: prev.sections.length, items: [] }],
        } : prev);
        setNewSectionTitle("");
        setAddingSectionTo(null);
      }
    });
  }

  function handleDeleteSection(sectionId: string) {
    startTransition(async () => {
      const res = await deleteSection(sectionId, studentId);
      if (res.success) {
        setPlan((prev) => prev ? { ...prev, sections: prev.sections.filter((s) => s.id !== sectionId) } : prev);
      }
    });
  }

  function handleAddItem(sectionId: string) {
    if (!newItemTitle.trim()) return;
    startTransition(async () => {
      const res = await addItem(sectionId, studentId, {
        title: newItemTitle,
        description: newItemDesc || null,
        imageUrl: newItemImage || null,
        sortOrder: (plan?.sections.find((s) => s.id === sectionId)?.items.length ?? 0),
      });
      if (res.success) {
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId ? s : {
                ...s,
                items: [...s.items, { id: res.id, section_id: sectionId, title: newItemTitle, description: newItemDesc || null, image_url: newItemImage || null, sort_order: s.items.length }],
              }
            ),
          };
        });
        setNewItemTitle("");
        setNewItemDesc("");
        setNewItemImage("");
        setAddingItemTo(null);
      }
    });
  }

  function handleDeleteItem(sectionId: string, itemId: string) {
    startTransition(async () => {
      const res = await deleteItem(itemId, studentId);
      if (res.success) {
        setPlan((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sections: prev.sections.map((s) =>
              s.id !== sectionId ? s : { ...s, items: s.items.filter((it) => it.id !== itemId) }
            ),
          };
        });
      }
    });
  }

  if (!plan) {
    return (
      <section>
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant mb-4">
          Master Plan
        </h3>
        <div className="bg-surface-card rounded-2xl p-6 flex flex-col items-center gap-3">
          <p className="text-on-surface-variant text-sm text-center">No master plan yet</p>
          <button
            onClick={handleCreatePlan}
            disabled={isPending}
            className="kinetic-gradient text-on-primary font-black py-2.5 px-6 rounded-xl text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Create Master Plan
          </button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-on-surface-variant">
          Master Plan
        </h3>
        <button
          onClick={() => setAddingSectionTo(plan.id)}
          className="text-primary text-xs font-bold uppercase tracking-wider"
        >
          + Section
        </button>
      </div>

      <div className="space-y-4">
        {plan.sections.map((section) => (
          <div
            key={section.id}
            className="bg-surface-card rounded-2xl p-4"
            style={{ borderTop: `2px solid ${CATEGORY_COLORS[section.category]}` }}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: CATEGORY_COLORS[section.category] }}>
                  {CATEGORY_LABELS[section.category]}
                </span>
                <p className="font-bold text-sm mt-0.5">{section.title}</p>
              </div>
              <button
                onClick={() => handleDeleteSection(section.id)}
                disabled={isPending}
                className="text-error text-xs opacity-60 hover:opacity-100"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>

            <div className="space-y-2 mb-3">
              {section.items.map((item) => (
                <div key={item.id} className="bg-surface-low rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{item.title}</p>
                      {item.description && (
                        <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{item.description}</p>
                      )}
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          className="mt-2 rounded-lg w-full object-cover max-h-48"
                        />
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteItem(section.id, item.id)}
                      disabled={isPending}
                      className="text-error opacity-40 hover:opacity-100 flex-shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {addingItemTo === section.id ? (
              <div className="bg-surface-low rounded-xl p-3 space-y-2">
                <input
                  className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/50"
                  placeholder="Item title"
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  autoFocus
                />
                <textarea
                  className="w-full bg-transparent text-xs text-on-surface-variant outline-none resize-none placeholder:text-on-surface-variant/40"
                  placeholder="Description (optional)"
                  rows={2}
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                />
                <input
                  className="w-full bg-transparent text-xs text-on-surface-variant outline-none placeholder:text-on-surface-variant/40"
                  placeholder="Image URL (optional)"
                  value={newItemImage}
                  onChange={(e) => setNewItemImage(e.target.value)}
                />
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleAddItem(section.id)}
                    disabled={isPending || !newItemTitle.trim()}
                    className="text-xs font-black text-primary uppercase tracking-wider disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingItemTo(null); setNewItemTitle(""); setNewItemDesc(""); setNewItemImage(""); }}
                    className="text-xs text-on-surface-variant uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingItemTo(section.id)}
                className="text-xs text-on-surface-variant uppercase tracking-widest font-bold opacity-50 hover:opacity-100"
              >
                + Add item
              </button>
            )}
          </div>
        ))}
      </div>

      {addingSectionTo === plan.id && (
        <div className="mt-4 bg-surface-card rounded-2xl p-4 space-y-3">
          <input
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-on-surface-variant/50"
            placeholder="Section title (e.g. Volley technique)"
            value={newSectionTitle}
            onChange={(e) => setNewSectionTitle(e.target.value)}
            autoFocus
          />
          <select
            className="w-full bg-surface-low rounded-lg px-3 py-2 text-xs font-bold text-on-surface outline-none"
            value={newSectionCategory}
            onChange={(e) => setNewSectionCategory(e.target.value as MasterPlanCategory)}
          >
            <option value="strength">Strengths</option>
            <option value="technique">Technique</option>
            <option value="tactics">Tactics</option>
            <option value="custom">Other</option>
          </select>
          <div className="flex gap-3">
            <button
              onClick={() => handleAddSection(plan.id)}
              disabled={isPending || !newSectionTitle.trim()}
              className="text-xs font-black text-primary uppercase tracking-wider disabled:opacity-40"
            >
              Add Section
            </button>
            <button
              onClick={() => { setAddingSectionTo(null); setNewSectionTitle(""); }}
              className="text-xs text-on-surface-variant uppercase tracking-wider"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
```

**Step 2: Добавь секцию мастер-плана в страницу тренера**

В `src/app/trainer/students/[id]/page.tsx`:

1. Импортируй в начало файла:
```typescript
import { getMasterPlan } from "@/lib/actions/masterPlan";
import MasterPlanEditor from "@/components/masterPlan/MasterPlanEditor";
```

2. После получения `sessions` добавь запрос:
```typescript
const masterPlan = await getMasterPlan(studentId);
```

3. В конце `<main>`, после секции Sessions, добавь:
```jsx
<MasterPlanEditor studentId={studentId} plan={masterPlan} />
```

**Step 3: Commit**

```bash
git add src/components/masterPlan/MasterPlanEditor.tsx src/app/trainer/students/[id]/page.tsx
git commit -m "feat: add MasterPlanEditor to trainer student page"
```

---

## Task 5: Страница мастер-плана для студента

**Files:**
- Create: `src/app/masterplan/page.tsx`
- Create: `src/app/masterplan/layout.tsx`

**Step 1: Создай layout**

```typescript
// src/app/masterplan/layout.tsx
import BottomNav from "@/components/navigation/BottomNav";

export default function MasterPlanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
```

**Step 2: Создай страницу**

```typescript
// src/app/masterplan/page.tsx
import { getSession } from "@/lib/auth/session";
import { getMasterPlan } from "@/lib/actions/masterPlan";
import { redirect } from "next/navigation";
import type { MasterPlanCategory } from "@/lib/types";

const CATEGORY_LABELS: Record<MasterPlanCategory, string> = {
  strength: "Strengths",
  technique: "Technique",
  tactics: "Tactics",
  custom: "Other",
};

const CATEGORY_COLORS: Record<MasterPlanCategory, string> = {
  strength: "#cafd00",
  technique: "#00f4fe",
  tactics: "#ff7351",
  custom: "#888",
};

export default async function MasterPlanPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const plan = await getMasterPlan(user.id);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">
          Master Plan
        </span>
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto">
        {!plan ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30">
              sports_tennis
            </span>
            <p className="text-on-surface-variant text-sm text-center max-w-xs">
              Your trainer hasn't created a master plan for you yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {plan.sections.map((section) => (
              <section key={section.id}>
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-1 h-5 rounded-full"
                    style={{ background: CATEGORY_COLORS[section.category] }}
                  />
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                    style={{ color: CATEGORY_COLORS[section.category] }}
                  >
                    {CATEGORY_LABELS[section.category]}
                  </span>
                </div>
                <h2 className="text-lg font-black tracking-tight mb-3 pl-3">{section.title}</h2>

                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className="bg-surface-card rounded-2xl overflow-hidden"
                      style={{ borderLeft: `3px solid ${CATEGORY_COLORS[section.category]}` }}
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          className="w-full object-cover max-h-64"
                        />
                      )}
                      <div className="p-4">
                        <p className="font-bold text-sm">{item.title}</p>
                        {item.description && (
                          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/masterplan/page.tsx src/app/masterplan/layout.tsx
git commit -m "feat: add student master plan page /masterplan"
```

---

## Task 6: Превью мастер-плана на дашборде студента

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Step 1: Добавь запрос и превью**

В `src/app/dashboard/page.tsx`:

1. Импортируй:
```typescript
import { getMasterPlan } from "@/lib/actions/masterPlan";
import Link from "next/link"; // уже есть
```

2. После запроса `pendingByCard` добавь:
```typescript
const masterPlan = await getMasterPlan(user.id);
const masterPlanPreview = masterPlan?.sections.slice(0, 2) ?? [];
```

3. В JSX, после блока "Action required" (и только если `!isEmpty`), добавь превью:
```jsx
{masterPlan && (
  <Link
    href="/masterplan"
    className="block bg-surface-low rounded-2xl p-4 active:bg-surface-card transition-colors"
  >
    <div className="flex items-center justify-between mb-3">
      <p className="text-secondary text-[10px] font-black uppercase tracking-[0.2em]">
        Master Plan
      </p>
      <span className="material-symbols-outlined text-on-surface-variant opacity-40 text-base">
        chevron_right
      </span>
    </div>
    <div className="space-y-1.5">
      {masterPlanPreview.map((section) => (
        <div key={section.id} className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary opacity-60 flex-shrink-0" />
          <p className="text-sm text-on-surface-variant truncate">{section.title}</p>
          <span className="text-[10px] text-on-surface-variant opacity-40 flex-shrink-0">
            {section.items.length} items
          </span>
        </div>
      ))}
      {(masterPlan.sections.length ?? 0) > 2 && (
        <p className="text-xs text-on-surface-variant opacity-40 pl-3.5">
          + {masterPlan.sections.length - 2} more sections
        </p>
      )}
    </div>
  </Link>
)}
```

**Step 2: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: add master plan preview to student dashboard"
```

---

## Task 7: Заполнить мастер-план Оли (seed данных)

**Files:**
- Create: `scripts/seed-olya-master-plan.ts`

Создать аккаунт для Оли и заполнить её мастер-план данными из диагностического документа https://www.grecha.one/diagnostics/olya-diana.html.

**Step 1: Узнай ID профиля Оли (если уже есть)**

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "select id, email, full_name from profiles where role = '"'"'student'"'"' order by created_at desc limit 10;"}'
```

**Step 2: Если нет — создай профиль для Оли через Supabase**

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "insert into profiles (id, email, full_name, role) values (gen_random_uuid(), '"'"'olya@nivel.app'"'"', '"'"'Оля'"'"', '"'"'student'"'"') returning id;"
  }'
```

Сохрани полученный `id` как `OLYA_ID`.

**Step 3: Создай мастер-план и секции через SQL**

```sql
-- Вставить мастер-план
insert into master_plans (student_id, trainer_id)
values (
  '<OLYA_ID>',
  (select id from profiles where role = 'trainer' limit 1)
)
returning id; -- сохрани как PLAN_ID

-- Секция 1: Сильная сторона
insert into master_plan_sections (plan_id, title, category, sort_order)
values ('<PLAN_ID>', 'Низкие мячи · работа ногами', 'strength', 0)
returning id; -- SECTION_STRENGTH_ID

-- Секция 2: Техника
insert into master_plan_sections (plan_id, title, category, sort_order)
values ('<PLAN_ID>', 'Технические ошибки', 'technique', 1)
returning id; -- SECTION_TECH_ID

-- Секция 3: Тактика
insert into master_plan_sections (plan_id, title, category, sort_order)
values ('<PLAN_ID>', 'Тактические ошибки', 'tactics', 2)
returning id; -- SECTION_TAC_ID
```

**Step 4: Заполни пункты секций**

Для секции Техника (`SECTION_TECH_ID`):
```sql
insert into master_plan_items (section_id, title, description, image_url, sort_order) values
('<SECTION_TECH_ID>', 'Стойка ног в защите слишком узкая', 'Когда играем в защите, нужна бо́льшая стабильность и крепкая опора — в этом помогает широкая стойка ног.', 'https://www.grecha.one/diagnostics/img/photo-1.jpg', 0),
('<SECTION_TECH_ID>', 'Нет поддержки левой руки', 'Левая рука должна снимать нагрузку с правой, держа ракетку за раму.', 'https://www.grecha.one/diagnostics/img/photo-2.jpg', 1),
('<SECTION_TECH_ID>', 'Разворот тела', 'Все удары, особенно у сетки, нужно делать в боковой позиции, когда время позволяет.', null, 2),
('<SECTION_TECH_ID>', 'Техника волей и бандехи', 'Форхенд волей с левой ноги, бэкхенд волей с крепким хватом, бандеха с согнутыми ногами.', 'https://www.grecha.one/diagnostics/img/photo-3.jpg', 3),
('<SECTION_TECH_ID>', 'У сетки ракетка находится внизу', 'В атаке нужно играть сверху вниз — волей, бандеху и т.д.', 'https://www.grecha.one/diagnostics/img/photo-6.jpg', 4);
```

Для секции Тактика (`SECTION_TAC_ID`):
```sql
insert into master_plan_items (section_id, title, description, image_url, sort_order) values
('<SECTION_TAC_ID>', 'Неправильная стартовая точка подачи', null, 'https://www.grecha.one/diagnostics/img/photo-7.jpg', 0),
('<SECTION_TAC_ID>', 'Не выбегаешь к сетке после подачи', 'После подачи нужно выдвигаться вперёд к сетке.', null, 1),
('<SECTION_TAC_ID>', 'Потеря позиции в транзитной зоне', null, 'https://www.grecha.one/diagnostics/img/photo-8.jpg', 2),
('<SECTION_TAC_ID>', 'Мало свечей и низкое их качество', 'Используй свечи как инструмент для смены позиции с защиты в атаку.', null, 3);
```

**Step 5: Commit**

```bash
git add scripts/seed-olya-master-plan.ts
git commit -m "chore: add Olya master plan seed script"
```

---

## Task 8: Ручная проверка

1. Запусти dev сервер: `npm run dev`
2. Войди как тренер
3. Открой `/trainer/students/<OLYA_ID>`
4. Убедись, что секция «Master Plan» показывает данные Оли с фотографиями
5. Попробуй добавить новую секцию и пункт — убедись, что изменения отображаются без перезагрузки
6. Войди как студент (Оля) — убедись, что `/masterplan` показывает мастер-план в read-only
7. Убедись, что превью на `/dashboard` появляется и ссылается на `/masterplan`

---

## Summary

| Task | Файлы | Что делает |
|------|-------|-----------|
| 1 | `supabase/migrations/007_master_plan.sql` | 3 новые таблицы |
| 2 | `src/lib/types/index.ts` | TypeScript типы |
| 3 | `src/lib/actions/masterPlan.ts` | CRUD server actions |
| 4 | `src/components/masterPlan/MasterPlanEditor.tsx`, `trainer/students/[id]/page.tsx` | Редактор для тренера |
| 5 | `src/app/masterplan/page.tsx`, `layout.tsx` | Read-only страница студента |
| 6 | `src/app/dashboard/page.tsx` | Превью на дашборде |
| 7 | Supabase SQL + seed | Данные Оли из документа |
| 8 | — | Ручная проверка |
