"use client";

import { useState, useTransition } from "react";
import { reorderInsightCards } from "@/lib/actions/insightCards";
import { ApprovedInsightCard } from "./ApprovedInsightCard";
import type { InsightCard } from "@/lib/types";

interface Props {
  sessionId: string;
  cards: InsightCard[];
}

export function ApprovedCardsReorderable({ sessionId, cards }: Props) {
  const [order, setOrder] = useState<InsightCard[]>(cards);
  const [, startTransition] = useTransition();

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    startTransition(async () => {
      await reorderInsightCards(sessionId, next.map((c) => c.id));
    });
  }

  return (
    <div className="space-y-3">
      {order.map((card, i) => (
        <div key={card.id} className="flex items-start gap-2">
          <div className="flex flex-col gap-1 pt-3 flex-shrink-0">
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label="Переместить вверх"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border-dim text-on-surface-variant disabled:opacity-20 active:bg-surface-card"
            >
              <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === order.length - 1}
              aria-label="Переместить вниз"
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-border-dim text-on-surface-variant disabled:opacity-20 active:bg-surface-card"
            >
              <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <ApprovedInsightCard
              card={card}
              onSaved={(patch) => {
                setOrder((prev) =>
                  prev.map((c) =>
                    c.id === card.id
                      ? { ...c, title: patch.title, body: patch.body, front_text: patch.title, context_text: patch.body, tags: patch.tags }
                      : c
                  )
                );
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
