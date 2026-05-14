"use client";

import { useEffect, useState } from "react";
import type { InsightCardWithRelations } from "@/lib/types";

interface Props {
  cards: InsightCardWithRelations[];
}

const FLIP_HINT_KEY = "nivel:vault-flip-hint-seen";

export default function VaultGrid({ cards }: Props) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());

  const firstCardId = cards[0]?.id;

  // One-time intro: on the very first visit, briefly flip the first card so the
  // user discovers the interaction. Persisted in localStorage — на последующих
  // заходах карточка показывается сразу без анимации.
  useEffect(() => {
    if (!firstCardId) return;
    if (localStorage.getItem(FLIP_HINT_KEY)) return;

    const flipOn = setTimeout(() => {
      setFlipped(new Set([firstCardId]));
    }, 500);
    const flipOff = setTimeout(() => {
      setFlipped((prev) => {
        const next = new Set(prev);
        next.delete(firstCardId);
        return next;
      });
      localStorage.setItem(FLIP_HINT_KEY, "1");
    }, 1900);

    return () => {
      clearTimeout(flipOn);
      clearTimeout(flipOff);
    };
  }, [firstCardId]);

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="material-symbols-outlined text-on-surface-variant text-5xl">
          inventory_2
        </span>
        <p className="text-on-surface font-bold">Здесь пока пусто</p>
        <p className="text-sm text-on-surface-variant max-w-xs">
          Карточки, которые вы возьмёте после сессий, появятся тут.
        </p>
      </div>
    );
  }

  function toggle(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card) => {
        const isFlipped = flipped.has(card.id);
        const front = card.student_edited_text || card.front_text;
        return (
          <div
            key={card.id}
            className={`vault-card ${isFlipped ? "flipped" : ""}`}
            onClick={() => toggle(card.id)}
          >
            <div className="vault-card-inner">
              <div className="vault-card-face">
                {card.category && (
                  <span className="text-[10px] uppercase tracking-widest text-secondary font-bold mb-1.5">
                    {card.category.name}
                  </span>
                )}
                <p className="text-sm font-bold text-on-surface leading-tight flex-1 line-clamp-3">
                  {front}
                </p>
                <span className="material-symbols-outlined text-on-surface-variant text-sm self-end opacity-50">
                  flip
                </span>
              </div>
              <div className="vault-card-face vault-card-back">
                {card.context_text ? (
                  <p className="text-xs text-on-surface leading-snug flex-1 line-clamp-4">
                    {card.context_text}
                  </p>
                ) : (
                  <p className="text-xs text-on-surface-variant italic flex-1">
                    Дополнительного контекста нет.
                  </p>
                )}
                {card.session && (
                  <p className="text-[10px] text-on-surface-variant mt-1 truncate">
                    Сессия №{card.session.session_number}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
