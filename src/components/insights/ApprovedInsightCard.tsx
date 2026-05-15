"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteAiInsightCard } from "@/lib/actions/aiInsights";
import { EditAiCardModal } from "./EditAiCardModal";
import type { InsightCard } from "@/lib/types";

interface Props {
  card: InsightCard;
}

export function ApprovedInsightCard({ card }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const displayText = card.title || card.front_text;
  const displayBody = card.body || card.context_text;
  const tag = card.tags?.[0] ?? null;

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteAiInsightCard(card.id);
      if ("error" in res) {
        setConfirmDelete(false);
        return;
      }
      setOpen(false);
      setConfirmDelete(false);
      router.refresh();
    });
  }

  function handleEdit() {
    setOpen(false);
    setEditing(true);
  }

  const sheet =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-[430px] mx-auto p-5 pb-8 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative rounded-3xl p-6 bg-white border border-gray-200 shadow-lg space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Approved
                  </span>
                  {tag && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {tag}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-black text-gray-900 leading-tight">
                  {displayText}
                </p>
                {displayBody && (
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {displayBody}
                  </p>
                )}
                {card.quote && (
                  <p className="text-xs text-gray-500 italic border-l-2 border-amber-400 pl-2">
                    «{card.quote}»
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  aria-label="Удалить"
                  className="w-16 h-16 rounded-full bg-white/95 border border-red-200 flex items-center justify-center active:scale-95 transition-transform shadow disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-red-500 text-3xl">
                    close
                  </span>
                </button>
                <button
                  onClick={handleEdit}
                  disabled={isPending}
                  aria-label="Редактировать"
                  className="w-16 h-16 rounded-full bg-white/95 border border-gray-200 flex items-center justify-center active:scale-95 transition-transform shadow disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-gray-700 text-2xl">
                    edit
                  </span>
                </button>
                <button
                  onClick={() => setOpen(false)}
                  disabled={isPending}
                  aria-label="Готово"
                  className="w-20 h-20 rounded-full kinetic-gradient glow-primary flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40"
                >
                  <span className="material-symbols-outlined fill-icon text-on-primary text-4xl">
                    check
                  </span>
                </button>
              </div>

              {confirmDelete && (
                <div className="rounded-2xl bg-surface-card border border-red-500/40 p-4 space-y-3">
                  <p className="text-sm font-bold text-on-surface">
                    Удалить карточку?
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    Карточка пропадёт у ученика и не вернётся в черновики.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      disabled={isPending}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-red-500 text-white min-h-[44px] disabled:opacity-40"
                    >
                      {isPending ? "Удаляем…" : "Удалить"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      disabled={isPending}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-border-dim text-on-surface min-h-[44px] disabled:opacity-40"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-2xl p-4 space-y-2 bg-surface-card border border-border-dim active:scale-[0.99] transition-transform cursor-pointer min-h-[44px]"
      >
        <p className="text-sm font-bold text-on-surface">{displayText}</p>
        {displayBody && (
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {displayBody}
          </p>
        )}
        {card.quote && (
          <p className="text-[10px] text-on-surface-variant italic border-l-2 border-primary/40 pl-2">
            «{card.quote}»
          </p>
        )}
      </button>

      {sheet}

      {editing && (
        <EditAiCardModal card={card} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
