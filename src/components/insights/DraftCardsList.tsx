"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { approveInsightCard, rejectInsightCard } from "@/lib/actions/aiInsights";
import { EditAiCardModal } from "./EditAiCardModal";
import type { InsightCard } from "@/lib/types";

const SWIPE_THRESHOLD = 110;

interface Props {
  cards: InsightCard[];
  isTrainer: boolean;
}

export function DraftCardsList({ cards, isTrainer }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<InsightCard[]>(cards);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [editingCard, setEditingCard] = useState<InsightCard | null>(null);
  const [, startTransition] = useTransition();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Sync local queue when the server-side cards list changes (e.g. after paste/refresh)
  useEffect(() => {
    setQueue(cards);
  }, [cards]);

  const top = queue[0];
  const next = queue[1];

  if (!top) {
    return (
      <div className="rounded-2xl bg-surface-card border border-border-dim p-6 text-center space-y-2">
        <span className="material-symbols-outlined fill-icon text-primary text-4xl">done_all</span>
        <p className="text-sm font-bold text-on-surface">Все черновики разобраны</p>
        <p className="text-xs text-on-surface-variant">
          Одобренные карточки уже видны ученику.
        </p>
      </div>
    );
  }

  function commit(decision: "approve" | "reject") {
    if (!top || exiting) return;
    setExiting(decision === "approve" ? "right" : "left");

    setTimeout(() => {
      startTransition(async () => {
        if (decision === "approve") {
          await approveInsightCard(top.id);
        } else {
          await rejectInsightCard(top.id);
        }
        router.refresh();
      });
      setQueue((q) => q.slice(1));
      setDrag(null);
      setExiting(null);
    }, 320);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (exiting) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current || exiting) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    });
  }
  function onPointerUp() {
    if (!drag || exiting) {
      startRef.current = null;
      return;
    }
    if (drag.x > SWIPE_THRESHOLD) commit("approve");
    else if (drag.x < -SWIPE_THRESHOLD) commit("reject");
    else setDrag(null);
    startRef.current = null;
  }

  const dx = drag?.x ?? 0;
  const rot = dx / 18;
  const opacity = exiting ? 0 : 1 - Math.min(Math.abs(dx) / 400, 0.4);

  return (
    <>
      <div className="space-y-5">
        <div className="tinder-stack">
          {next && <DraftCardFace card={next} stacked />}
          <div
            className={`tinder-card ${drag ? "dragging" : ""} ${
              exiting === "right" ? "swipe-right" : exiting === "left" ? "swipe-left" : ""
            }`}
            style={{
              transform: exiting
                ? undefined
                : `translateX(${dx}px) translateY(${(drag?.y ?? 0) * 0.3}px) rotate(${rot}deg)`,
              opacity,
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <DraftCardFace card={top} dx={dx} />
          </div>
        </div>

        {isTrainer && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => commit("reject")}
              aria-label="Отклонить"
              className="w-16 h-16 rounded-full bg-white/95 border border-red-200 flex items-center justify-center active:scale-95 transition-transform shadow"
            >
              <span className="material-symbols-outlined text-red-500 text-3xl">close</span>
            </button>
            <button
              onClick={() => setEditingCard(top)}
              aria-label="Редактировать"
              className="w-16 h-16 rounded-full bg-white/95 border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shadow"
            >
              <span className="material-symbols-outlined text-gray-700 text-2xl">edit</span>
            </button>
            <button
              onClick={() => commit("approve")}
              aria-label="Принять"
              className="w-20 h-20 rounded-full kinetic-gradient glow-primary flex items-center justify-center active:scale-95 transition-transform"
            >
              <span className="material-symbols-outlined fill-icon text-on-primary text-4xl">
                check
              </span>
            </button>
          </div>
        )}

        <p className="text-center text-xs uppercase tracking-widest text-on-surface-variant">
          Осталось: {queue.length}
        </p>
      </div>

      {editingCard && (
        <EditAiCardModal card={editingCard} onClose={() => setEditingCard(null)} />
      )}
    </>
  );
}

function DraftCardFace({
  card,
  stacked,
  dx = 0,
}: {
  card: InsightCard;
  stacked?: boolean;
  dx?: number;
}) {
  const title = card.title || card.front_text || "";
  const body = card.body || card.context_text || "";
  const tag = card.tags?.[0] ?? null;

  return (
    <div
      className={`absolute inset-0 rounded-3xl p-6 flex flex-col justify-between bg-white border border-gray-200 shadow-lg ${
        stacked ? "scale-[0.94] -translate-y-3 opacity-60" : ""
      }`}
    >
      {!stacked && (
        <>
          <div
            className="absolute top-6 left-6 z-10 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-green-500 text-white"
            style={{ opacity: Math.max(0, Math.min(1, dx / 80)) }}
          >
            Принять
          </div>
          <div
            className="absolute top-6 right-6 z-10 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500 text-white"
            style={{ opacity: Math.max(0, Math.min(1, -dx / 80)) }}
          >
            Отклонить
          </div>
        </>
      )}
      <div className="flex flex-col gap-3 mt-10">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            AI черновик
          </span>
          {tag && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {tag}
            </span>
          )}
        </div>
        <p className="text-2xl font-black text-gray-900 leading-tight">{title}</p>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        {body && (
          <p className="text-sm text-gray-700 leading-relaxed">{body}</p>
        )}
        {card.quote && (
          <p className="text-xs text-gray-500 italic border-l-2 border-amber-400 pl-2">
            «{card.quote}»
          </p>
        )}
      </div>
    </div>
  );
}
