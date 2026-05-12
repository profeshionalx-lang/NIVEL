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
