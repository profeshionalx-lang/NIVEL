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
      // datetime-local has no timezone — append Z to treat the entered time as UTC literally
      const iso = date ? `${date}:00.000Z` : null;
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
