"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInsightCard,
  updateInsightCard,
  setTrainerCardStatus,
  deleteInsightCard,
} from "@/lib/actions/insightCards";
import { setTrainerReviewCompleted } from "@/lib/actions/sessions";
import type { InsightCard, ProblemCategory, Problem } from "@/lib/types";

interface Props {
  sessionId: string;
  cards: InsightCard[];
  categories: ProblemCategory[];
  problems: Problem[];
  reviewCompleted: boolean;
}

export default function TrainerCardEditor({
  sessionId,
  cards,
  categories,
  problems,
  reviewCompleted,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draftFront, setDraftFront] = useState("");
  const [draftContext, setDraftContext] = useState("");
  const [draftProblemId, setDraftProblemId] = useState<number | "">("");

  function reload() {
    router.refresh();
  }

  function handleAdd() {
    if (!draftFront.trim()) return;
    startTransition(async () => {
      const res = await createInsightCard(sessionId, {
        frontText: draftFront,
        contextText: draftContext || null,
        problemId: draftProblemId === "" ? null : Number(draftProblemId),
      });
      if (!res.success) {
        alert(res.error);
        return;
      }
      setDraftFront("");
      setDraftContext("");
      setDraftProblemId("");
      reload();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface-card p-4 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          Add a new card
        </p>
        <textarea
          value={draftFront}
          onChange={(e) => setDraftFront(e.target.value)}
          placeholder="One principle, one line"
          rows={2}
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
        />
        <textarea
          value={draftContext}
          onChange={(e) => setDraftContext(e.target.value)}
          placeholder="When to use it (optional)"
          rows={2}
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
        />
        <select
          value={draftProblemId}
          onChange={(e) =>
            setDraftProblemId(e.target.value ? Number(e.target.value) : "")
          }
          className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
        >
          <option value="">No linked problem</option>
          {categories.map((c) => (
            <optgroup key={c.id} label={c.name}>
              {problems
                .filter((p) => p.category_id === c.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          onClick={handleAdd}
          disabled={!draftFront.trim()}
          className="w-full py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40"
        >
          Add card (draft)
        </button>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          Cards ({cards.length})
        </p>
        {cards.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No cards yet.</p>
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <CardRow
                key={c.id}
                card={c}
                problems={problems}
                onChanged={reload}
              />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface-card p-4 space-y-3">
        <p className="text-sm text-on-surface">
          {reviewCompleted
            ? "Review marked as finished. Student can swipe approved cards."
            : "When you're done curating, mark the review as finished. The student will be notified."}
        </p>
        <button
          onClick={() =>
            startTransition(async () => {
              await setTrainerReviewCompleted(sessionId, !reviewCompleted);
              reload();
            })
          }
          className={`w-full py-3 rounded-xl font-bold text-sm ${
            reviewCompleted
              ? "border border-border-dim text-on-surface"
              : "kinetic-gradient text-on-primary"
          }`}
        >
          {reviewCompleted ? "Reopen review" : "Finish review"}
        </button>
      </section>
    </div>
  );
}

function CardRow({
  card,
  problems,
  onChanged,
}: {
  card: InsightCard;
  problems: Problem[];
  onChanged: () => void;
}) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front_text);
  const [context, setContext] = useState(card.context_text ?? "");
  const [problemId, setProblemId] = useState<number | "">(card.problem_id ?? "");

  function save() {
    startTransition(async () => {
      await updateInsightCard(card.id, {
        frontText: front,
        contextText: context || null,
        problemId: problemId === "" ? null : Number(problemId),
      });
      setEditing(false);
      onChanged();
    });
  }

  const statusBadge = {
    draft: "bg-surface-elevated text-on-surface-variant",
    approved: "bg-primary text-on-primary",
    rejected: "bg-error/20 text-error",
  }[card.trainer_status];

  return (
    <div className="rounded-2xl bg-surface-card p-4 space-y-3 border border-border-dim">
      <div className="flex items-center justify-between">
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusBadge}`}
        >
          {card.trainer_status}
        </span>
        {card.student_decision && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            student: {card.student_decision}
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={front}
            onChange={(e) => setFront(e.target.value)}
            rows={2}
            className="w-full bg-surface-elevated rounded-xl p-2 text-sm text-on-surface border border-border-dim"
          />
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder="Context (optional)"
            className="w-full bg-surface-elevated rounded-xl p-2 text-sm text-on-surface border border-border-dim"
          />
          <select
            value={problemId}
            onChange={(e) =>
              setProblemId(e.target.value ? Number(e.target.value) : "")
            }
            className="w-full bg-surface-elevated rounded-xl p-2 text-sm text-on-surface border border-border-dim"
          >
            <option value="">No linked problem</option>
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={save}
              className="flex-1 py-2 rounded-xl text-xs font-bold kinetic-gradient text-on-primary"
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2 rounded-xl text-xs font-bold border border-border-dim text-on-surface"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm font-bold text-on-surface">{card.front_text}</p>
          {card.context_text && (
            <p className="text-xs text-on-surface-variant">{card.context_text}</p>
          )}
        </>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() =>
              startTransition(async () => {
                await setTrainerCardStatus(card.id, "approved");
                onChanged();
              })
            }
            disabled={card.trainer_status === "approved"}
            className="flex-1 min-w-24 py-2 rounded-xl text-xs font-bold kinetic-gradient text-on-primary disabled:opacity-40"
          >
            Approve
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex-1 min-w-24 py-2 rounded-xl text-xs font-bold border border-border-dim text-on-surface"
          >
            Edit
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await setTrainerCardStatus(card.id, "rejected");
                onChanged();
              })
            }
            disabled={card.trainer_status === "rejected"}
            className="flex-1 min-w-24 py-2 rounded-xl text-xs font-bold border border-border-dim text-error disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={() => {
              if (!confirm("Delete this card?")) return;
              startTransition(async () => {
                await deleteInsightCard(card.id);
                onChanged();
              });
            }}
            className="py-2 px-3 rounded-xl text-xs font-bold border border-border-dim text-error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
