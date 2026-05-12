"use client";

import { useState, useTransition } from "react";
import { attachInsightToMatch, detachInsightFromMatch } from "@/lib/actions/playtomic";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

interface InsightOption {
  id: string;
  front_text: string;
  problem?: { name: string } | null;
}

interface Props {
  matchId: string;
  locale: Locale;
  allInsights: InsightOption[];
  attachedIds: string[];
}

export default function AttachInsightModal({
  matchId,
  locale,
  allInsights,
  attachedIds,
}: Props) {
  const [open, setOpen] = useState(false);
  // Local selection state — starts from currently attached
  const [selected, setSelected] = useState<Set<string>>(new Set(attachedIds));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpen() {
    setSelected(new Set(attachedIds));
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function toggleInsight(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const toAttach = [...selected].filter((id) => !attachedIds.includes(id));
      const toDetach = attachedIds.filter((id) => !selected.has(id));

      try {
        await Promise.all([
          ...toAttach.map((id) => attachInsightToMatch(matchId, id)),
          ...toDetach.map((id) => detachInsightFromMatch(matchId, id)),
        ]);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl kinetic-gradient text-on-primary text-xs font-black uppercase tracking-widest"
      >
        <span className="material-symbols-outlined text-[16px]">flag</span>
        {t(locale, "matches.detail.attachInsight")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-[430px] bg-surface-card rounded-3xl p-6 space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-black uppercase tracking-widest text-on-surface shrink-0">
              {t(locale, "matches.detail.modalTitle")}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {allInsights.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">
                  {t(locale, "matches.detail.modalEmpty")}
                </p>
              ) : (
                allInsights.map((insight) => {
                  const isChecked = selected.has(insight.id);
                  return (
                    <button
                      key={insight.id}
                      type="button"
                      onClick={() => toggleInsight(insight.id)}
                      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isChecked
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-surface-elevated border border-transparent hover:bg-border-dim"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${
                          isChecked ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {isChecked ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface leading-snug">
                          {insight.front_text}
                        </p>
                        {insight.problem?.name && (
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            {insight.problem.name}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {error && <p className="text-xs text-error shrink-0">{error}</p>}

            <div className="flex gap-3 shrink-0">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-on-surface-variant bg-surface-elevated hover:bg-border-dim disabled:opacity-40 transition-colors"
              >
                {t(locale, "matches.detail.modalCancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending
                  ? t(locale, "matches.detail.modalSaving")
                  : t(locale, "matches.detail.modalSave")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
