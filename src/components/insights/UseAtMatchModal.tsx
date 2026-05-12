"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { attachInsightToMatch } from "@/lib/actions/playtomic";
import { t } from "@/lib/i18n/dict";
import type { Locale } from "@/lib/i18n/dict";

export interface UpcomingMatchOption {
  id: string;
  start_date: string;
  location: string | null;
  resource_name: string | null;
}

interface Props {
  insightId: string;
  locale: Locale;
  upcomingMatches: UpcomingMatchOption[];
}

function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UseAtMatchModal({ insightId, locale, upcomingMatches }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleOpen() {
    setSelectedMatchId(null);
    setError(null);
    setAttached(false);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSave() {
    if (!selectedMatchId) return;
    setError(null);
    startTransition(async () => {
      const result = await attachInsightToMatch(selectedMatchId, insightId);
      if (!result.success) {
        setError(result.error);
      } else {
        setAttached(true);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        className={`mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
          attached
            ? "text-primary"
            : "text-on-surface-variant hover:text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">
          {attached ? "check_circle" : "sports_tennis"}
        </span>
        {attached
          ? t(locale, "insights.useAtMatch.success")
          : t(locale, "insights.useAtMatch")}
      </button>

      {open && mounted && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-[430px] bg-surface-card rounded-t-3xl p-6 space-y-4 max-h-[85vh] flex flex-col"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-black uppercase tracking-widest text-on-surface shrink-0">
              {t(locale, "insights.useAtMatch.modalTitle")}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
              {upcomingMatches.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-4">
                  {t(locale, "insights.useAtMatch.modalEmpty")}
                </p>
              ) : (
                upcomingMatches.map((match) => {
                  const isSelected = selectedMatchId === match.id;
                  return (
                    <button
                      key={match.id}
                      type="button"
                      onClick={() => setSelectedMatchId(match.id)}
                      className={`w-full text-left flex items-start gap-3 px-3 py-3 rounded-xl transition-colors ${
                        isSelected
                          ? "bg-primary/15 border border-primary/40"
                          : "bg-surface-elevated border border-transparent hover:bg-border-dim"
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-[20px] mt-0.5 shrink-0 ${
                          isSelected ? "text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {isSelected ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-on-surface leading-snug">
                          {formatMatchDate(match.start_date)}
                        </p>
                        {(match.location || match.resource_name) && (
                          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                            {[match.location, match.resource_name]
                              .filter(Boolean)
                              .join(" · ")}
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
                {t(locale, "insights.useAtMatch.modalCancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={isPending || !selectedMatchId}
                className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending
                  ? t(locale, "insights.useAtMatch.modalSaving")
                  : t(locale, "insights.useAtMatch.modalSave")}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
