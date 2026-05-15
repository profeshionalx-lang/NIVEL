"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveInsightCard, rejectInsightCard } from "@/lib/actions/aiInsights";
import type { InsightCard } from "@/lib/types";

interface Props {
  card: InsightCard;
  isTrainer: boolean;
  onEdit?: (card: InsightCard) => void;
}

export function AiInsightCard({ card, isTrainer, onEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isDraft = card.trainer_status === "draft";
  const displayText = card.title || card.front_text;
  const displayBody = card.body || card.context_text;

  function approve() {
    startTransition(async () => {
      await approveInsightCard(card.id);
      router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      await rejectInsightCard(card.id);
      router.refresh();
    });
  }

  return (
    <div
      className={`rounded-2xl p-4 space-y-2 ${
        isDraft
          ? "bg-surface-card border border-amber-500/40"
          : "bg-surface-card border border-border-dim"
      }`}
    >
      {isDraft && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
            AI draft
          </span>
          {card.tags && card.tags.length > 0 && (
            <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">
              {card.tags[0]}
            </span>
          )}
        </div>
      )}

      <p className="text-sm font-bold text-on-surface">{displayText}</p>

      {displayBody && (
        <p className="text-xs text-on-surface-variant leading-relaxed">{displayBody}</p>
      )}

      {card.quote && (
        <p className="text-[10px] text-on-surface-variant italic border-l-2 border-primary/40 pl-2">
          «{card.quote}»
        </p>
      )}

      {isDraft && isTrainer && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={approve}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold kinetic-gradient text-on-primary disabled:opacity-40 min-h-[44px]"
          >
            ✓ Approve
          </button>
          {onEdit && (
            <button
              onClick={() => onEdit(card)}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-border-dim text-on-surface min-h-[44px]"
            >
              ✎ Edit
            </button>
          )}
          <button
            onClick={reject}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-border-dim text-error min-h-[44px]"
          >
            ✗ Reject
          </button>
        </div>
      )}
    </div>
  );
}
