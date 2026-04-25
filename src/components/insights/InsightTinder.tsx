"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideInsightCard } from "@/lib/actions/insightCards";
import type { InsightCardWithRelations } from "@/lib/types";

interface Props {
  cards: InsightCardWithRelations[];
}

const SWIPE_THRESHOLD = 110;

export default function InsightTinder({ cards }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const [, startTransition] = useTransition();
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const top = queue[0];
  const next = queue[1];

  if (!top) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="material-symbols-outlined fill-icon text-primary text-6xl">
          done_all
        </span>
        <p className="text-on-surface font-bold">All cards reviewed</p>
        <p className="text-sm text-on-surface-variant">
          Open the Insights tab to revisit what you took.
        </p>
      </div>
    );
  }

  function commit(decision: "taken" | "skipped") {
    if (!top || exiting) return;
    setExiting(decision === "taken" ? "right" : "left");

    setTimeout(() => {
      startTransition(async () => {
        await decideInsightCard(top.id, decision);
      });
      setQueue((q) => q.slice(1));
      setDrag(null);
      setExiting(null);
      router.refresh();
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
    if (drag.x > SWIPE_THRESHOLD) commit("taken");
    else if (drag.x < -SWIPE_THRESHOLD) commit("skipped");
    else setDrag(null);
    startRef.current = null;
  }

  const dx = drag?.x ?? 0;
  const rot = dx / 18;
  const opacity = exiting ? 0 : 1 - Math.min(Math.abs(dx) / 400, 0.4);

  return (
    <div className="space-y-6">
      <div className="tinder-stack">
        {next && <CardFace card={next} stacked />}
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
          <CardFace card={top} dx={dx} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => commit("skipped")}
          aria-label="Skip"
          className="w-16 h-16 rounded-full bg-surface-card border border-border-dim flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-error text-3xl">close</span>
        </button>
        <button
          onClick={() => commit("taken")}
          aria-label="Take"
          className="w-20 h-20 rounded-full kinetic-gradient glow-primary flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined fill-icon text-on-primary text-4xl">
            favorite
          </span>
        </button>
      </div>

      <p className="text-center text-xs uppercase tracking-widest text-on-surface-variant">
        {queue.length} {queue.length === 1 ? "card" : "cards"} left
      </p>
    </div>
  );
}

function CardFace({
  card,
  stacked,
  dx = 0,
}: {
  card: InsightCardWithRelations;
  stacked?: boolean;
  dx?: number;
}) {
  return (
    <div
      className={`absolute inset-0 rounded-3xl p-6 flex flex-col justify-between bg-surface-card border border-border-dim ${
        stacked ? "scale-[0.94] -translate-y-3 opacity-60" : ""
      }`}
    >
      {!stacked && (
        <>
          <div
            className="absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary text-on-primary"
            style={{ opacity: Math.max(0, Math.min(1, dx / 80)) }}
          >
            Take
          </div>
          <div
            className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-error text-white"
            style={{ opacity: Math.max(0, Math.min(1, -dx / 80)) }}
          >
            Skip
          </div>
        </>
      )}
      <div className="flex flex-col gap-3 mt-12">
        {card.category && (
          <span className="text-xs uppercase tracking-widest text-secondary font-bold">
            {card.category.name}
          </span>
        )}
        <p className="text-2xl font-black text-on-surface leading-tight">
          {card.front_text}
        </p>
      </div>
      {card.context_text && (
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {card.context_text}
        </p>
      )}
    </div>
  );
}
