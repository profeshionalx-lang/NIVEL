"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateInsightCard,
  setTrainerCardStatus,
  deleteInsightCard,
  reorderInsightCards,
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
  const [order, setOrder] = useState<InsightCard[]>(cards);

  useEffect(() => {
    setOrder(cards);
  }, [cards]);

  function reload() {
    router.refresh();
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startTransition(async () => {
      await reorderInsightCards(
        sessionId,
        next.map((c) => c.id)
      );
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
          Cards ({order.length})
        </p>
        {order.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No cards yet.</p>
        ) : (
          <div className="space-y-3">
            {order.map((c, i) => (
              <CardRow
                key={c.id}
                card={c}
                problems={problems}
                onChanged={reload}
                onMove={(dir) => move(i, dir)}
                isFirst={i === 0}
                isLast={i === order.length - 1}
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
  onMove,
  isFirst,
  isLast,
}: {
  card: InsightCard;
  problems: Problem[];
  onChanged: () => void;
  onMove: (direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front_text);
  const [context, setContext] = useState(card.context_text ?? "");
  const [problemId, setProblemId] = useState<number | "">(card.problem_id ?? "");
  const [side, setSide] = useState<"" | "защита" | "атака">(
    (card.tags?.[1] as "" | "защита" | "атака") ?? ""
  );

  function save() {
    const topic = card.tags?.[0] ?? "техника";
    const newTags = side ? [topic, side] : [topic];
    startTransition(async () => {
      await updateInsightCard(card.id, {
        frontText: front,
        contextText: context || null,
        problemId: problemId === "" ? null : Number(problemId),
        tags: newTags,
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
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${statusBadge}`}
        >
          {card.trainer_status}
        </span>
        <div className="flex items-center gap-2">
          {card.student_decision && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              student: {card.student_decision}
            </span>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={() => onMove(-1)}
              disabled={isFirst}
              aria-label="Move card up"
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-border-dim text-on-surface disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-lg">
                keyboard_arrow_up
              </span>
            </button>
            <button
              onClick={() => onMove(1)}
              disabled={isLast}
              aria-label="Move card down"
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-border-dim text-on-surface disabled:opacity-30"
            >
              <span className="material-symbols-outlined text-lg">
                keyboard_arrow_down
              </span>
            </button>
          </div>
        </div>
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
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as "" | "защита" | "атака")}
            className="w-full bg-surface-elevated rounded-xl p-2 text-sm text-on-surface border border-border-dim"
          >
            <option value="">Сторона: не указана</option>
            <option value="защита">Защита</option>
            <option value="атака">Атака</option>
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
