"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { decideInsightCard } from "@/lib/actions/insightCards";
import type { InsightCardWithRelations } from "@/lib/types";

interface Props {
  cards: InsightCardWithRelations[];
}

const SWIPE_THRESHOLD = 110;
const TAP_THRESHOLD = 8;
const COMMIT_MS = 380;

export default function InsightTinder({ cards }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [committing, setCommitting] = useState<"left" | "right" | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [intro, setIntro] = useState(false);
  const [, startTransition] = useTransition();
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const introPlayedRef = useRef(false);
  const total = cards.length;

  const top = queue[0];
  const currentIndex = total - queue.length + 1;
  const topId = top?.id;

  useEffect(() => {
    setFlipped(false);
    if (!topId || introPlayedRef.current) return;
    introPlayedRef.current = true;
    setIntro(true);
    const t = setTimeout(() => setIntro(false), 2700);
    return () => clearTimeout(t);
  }, [topId]);

  if (!top) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="material-symbols-outlined fill-icon text-primary text-6xl">
          done_all
        </span>
        <p className="text-on-surface font-bold">Все карточки разобраны</p>
        <p className="text-sm text-on-surface-variant">
          Откройте вкладку «Карточки», чтобы вернуться к взятым.
        </p>
      </div>
    );
  }

  function commit(decision: "taken" | "skipped") {
    if (!top || committing) return;
    const dir = decision === "taken" ? "right" : "left";
    setCommitting(dir);
    setDrag(null);

    setTimeout(() => {
      startTransition(async () => {
        await decideInsightCard(top.id, decision);
      });
      setQueue((q) => q.slice(1));
      setCommitting(null);
      router.refresh();
    }, COMMIT_MS);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (committing) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current || committing) return;
    setDrag({
      x: e.clientX - startRef.current.x,
      y: e.clientY - startRef.current.y,
    });
  }
  function onPointerUp() {
    if (!drag || committing) {
      startRef.current = null;
      return;
    }
    if (drag.x > SWIPE_THRESHOLD) commit("taken");
    else if (drag.x < -SWIPE_THRESHOLD) commit("skipped");
    else if (Math.abs(drag.x) < TAP_THRESHOLD && Math.abs(drag.y) < TAP_THRESHOLD) {
      setIntro(false);
      setFlipped((f) => !f);
      setDrag(null);
    } else {
      setDrag(null);
    }
    startRef.current = null;
  }

  const dx = drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const dragProgress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
  const isDragging = !!drag;

  function slotStyle(slot: number, slotProgress: number): React.CSSProperties {
    if (slot === -1) {
      const dir = committing === "right" ? 1 : -1;
      return {
        transform: `translateX(${dir * 140}%) rotate(${dir * 22}deg)`,
        opacity: 0,
      };
    }
    if (slot === 0) {
      if (isDragging) {
        const rot = dx / 18;
        return {
          transform: `translateX(${dx}px) translateY(${dy * 0.3}px) rotate(${rot}deg)`,
          opacity: 1 - Math.min(Math.abs(dx) / 420, 0.3),
        };
      }
      return { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 };
    }
    if (slot === 1) {
      const lift = slotProgress;
      const ty = -22 + lift * 22;
      const rot = -5 + lift * 5;
      const scale = 0.93 + lift * 0.07;
      const opacity = 0.6 + lift * 0.4;
      return {
        transform: `translateY(${ty}px) rotate(${rot}deg) scale(${scale})`,
        opacity,
      };
    }
    if (slot === 2) {
      return {
        transform: "translateY(-38px) rotate(6deg) scale(0.88)",
        opacity: 0.36,
      };
    }
    return { transform: "translateY(-44px) scale(0.84)", opacity: 0 };
  }

  function slotFor(i: number) {
    return committing ? i - 1 : i;
  }

  const visible = queue.slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 backdrop-blur px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-on-surface-variant">
          <span className="text-primary">{currentIndex}</span>
          <span className="opacity-50">/</span>
          <span className="opacity-70">{total}</span>
        </span>
      </div>

      <div className="tinder-stack">
        {visible.map((card, i) => {
          const slot = slotFor(i);
          const isTopSlot = slot === 0;
          const isExiting = slot === -1;
          const slotProgress = slot === 1 ? dragProgress : 0;
          const style = slotStyle(slot, slotProgress);
          const zIndex = slot === -1 ? 4 : slot === 0 ? 3 : slot === 1 ? 2 : 1;

          return (
            <div
              key={card.id}
              className={`tinder-card ${isTopSlot && isDragging ? "dragging" : ""} ${
                isTopSlot ? "" : "pointer-events-none"
              }`}
              style={{ ...style, zIndex }}
              onPointerDown={isTopSlot ? onPointerDown : undefined}
              onPointerMove={isTopSlot ? onPointerMove : undefined}
              onPointerUp={isTopSlot ? onPointerUp : undefined}
              onPointerCancel={isTopSlot ? onPointerUp : undefined}
            >
              <div className="insight-flip">
                <div
                  className={`insight-flip-inner ${isTopSlot && flipped ? "flipped" : ""} ${
                    isTopSlot && intro && !flipped ? "intro" : ""
                  }`}
                >
                  <div className="insight-flip-face">
                    <FrontFace
                      card={card}
                      dx={isTopSlot ? dx : 0}
                      preview={!isTopSlot && !isExiting}
                      previewOpacity={slot === 1 ? dragProgress : 0}
                      muted={slot === 2}
                    />
                  </div>
                  <div className="insight-flip-face insight-flip-back">
                    <BackFace card={card} />
                  </div>
                </div>
                {isTopSlot && intro && !flipped && (
                  <>
                    <span className="insight-tap-ring" />
                    <span className="insight-tap-hint">
                      <span className="material-symbols-outlined fill-icon text-primary text-[44px] drop-shadow-[0_4px_12px_rgba(202,253,0,0.45)]">
                        touch_app
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-6 pt-2">
        <button
          onClick={() => commit("skipped")}
          aria-label="Пропустить"
          className="w-16 h-16 rounded-full bg-surface-card border border-border-dim flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-error text-3xl">close</span>
        </button>
        <button
          onClick={() => commit("taken")}
          aria-label="Взять"
          className="w-20 h-20 rounded-full kinetic-gradient glow-primary flex items-center justify-center active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined fill-icon text-on-primary text-4xl">
            favorite
          </span>
        </button>
      </div>
    </div>
  );
}

function sideMeta(side: string | null | undefined) {
  if (side === "защита" || side === "defense") {
    return { label: "Защита", className: "bg-sky-100 text-sky-700" };
  }
  if (side === "атака" || side === "attack") {
    return { label: "Атака", className: "bg-rose-100 text-rose-700" };
  }
  return null;
}

function FrontFace({
  card,
  dx,
  preview,
  previewOpacity = 0,
  muted,
}: {
  card: InsightCardWithRelations;
  dx: number;
  preview?: boolean;
  previewOpacity?: number;
  muted?: boolean;
}) {
  const topic = card.tags?.[0] ?? null;
  const side = sideMeta(card.tags?.[1] ?? null);
  const displayTitle = card.title || card.front_text;

  // Preview = next-in-line: text fades in as user drags top away.
  // Muted = ghost (slot 2): barely-visible silhouette.
  const contentOpacity = muted ? 0 : preview ? 0.18 + previewOpacity * 0.82 : 1;

  return (
    <div className="relative h-full w-full p-6 flex flex-col">
      {!preview && !muted && (
        <>
          <div
            className="absolute top-5 left-5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-primary text-on-primary z-10"
            style={{ opacity: Math.max(0, Math.min(1, dx / 80)) }}
          >
            Взять
          </div>
          <div
            className="absolute top-5 right-5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500 text-white z-10"
            style={{ opacity: Math.max(0, Math.min(1, -dx / 80)) }}
          >
            Пропустить
          </div>
          <span
            className="absolute bottom-5 right-5 w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <span className="material-symbols-outlined text-[18px]">touch_app</span>
          </span>
        </>
      )}

      <div
        className="flex flex-col gap-4 mt-8 transition-opacity duration-150"
        style={{ opacity: contentOpacity }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {topic && (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
              {topic}
            </span>
          )}
          {side && (
            <span
              className={`text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full ${side.className}`}
            >
              {side.label}
            </span>
          )}
        </div>
        <p className="text-[28px] font-black text-gray-900 leading-[1.05] tracking-tight">
          {displayTitle}
        </p>
      </div>
    </div>
  );
}

function BackFace({ card }: { card: InsightCardWithRelations }) {
  const body = card.body || card.context_text || "";
  const quote = card.quote || "";
  const total = body.length + quote.length;

  const bodySize =
    total > 520 ? "text-[13px] leading-snug" :
    total > 320 ? "text-[14px] leading-snug" :
    total > 160 ? "text-[15px] leading-relaxed" :
    "text-[17px] leading-relaxed";

  const quoteSize =
    total > 520 ? "text-[12px]" :
    total > 320 ? "text-[13px]" :
    "text-sm";

  return (
    <div className="h-full w-full p-5 flex flex-col">
      <div className="flex items-center gap-2 text-gray-400 mb-3 flex-shrink-0">
        <span className="material-symbols-outlined text-base">flip_to_front</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Разбор
        </span>
      </div>
      {body && (
        <p className={`text-gray-800 whitespace-pre-line ${bodySize}`}>
          {body}
        </p>
      )}
      <div className="flex-1" />
      {quote && (
        <p
          className={`text-gray-500 italic border-l-2 border-amber-400 pl-3 mt-4 flex-shrink-0 ${quoteSize}`}
        >
          «{quote}»
        </p>
      )}
      {!body && !quote && (
        <p className="text-sm text-gray-500">Описание не добавлено.</p>
      )}
    </div>
  );
}
