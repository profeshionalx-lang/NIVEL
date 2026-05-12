// src/components/dashboard/edit/InlineGoalCreator.tsx
"use client";

import { useState, useTransition, useEffect, type MouseEvent, type ChangeEvent } from "react";
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
      .then(({ data }: { data: Record<string, unknown>[] | null }) => {
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
          <div className="bg-surface-card rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e: MouseEvent) => e.stopPropagation()}>
            <h3 className="text-lg font-black tracking-tight">New goal</h3>
            <textarea
              value={customProblem}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setCustomProblem(e.target.value)}
              placeholder="Describe the problem (or leave empty and pick from list)"
              rows={2}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            <select
              value={problemId}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setProblemId(e.target.value ? Number(e.target.value) : "")}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
            >
              <option value="">— Link a problem (optional) —</option>
              {problems.map((p: Problem) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
