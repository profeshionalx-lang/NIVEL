"use client";

import { useState, useTransition } from "react";
import { addMatchByUrlAction } from "@/lib/actions/playtomic";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

interface Props {
  locale: Locale;
}

export default function AddMatchByUrlModal({ locale }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen() {
    setUrl("");
    setError(null);
    setOpen(true);
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await addMatchByUrlAction(url);
      if (!result.success) {
        setError(result.error);
      } else {
        setOpen(false);
        setUrl("");
      }
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label={t(locale, "matches.addByUrl")}
        title={t(locale, "matches.addByUrl")}
        className="flex items-center justify-center h-11 w-11 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
      >
        <span className="material-symbols-outlined text-[20px]">add_link</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-4 pb-8"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-[430px] bg-surface-card rounded-3xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-black uppercase tracking-widest text-on-surface">
              {t(locale, "matches.addByUrl")}
            </p>

            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t(locale, "matches.addByUrlPlaceholder")}
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
              disabled={isPending}
              autoFocus
            />

            {error && <p className="text-xs text-error">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest text-on-surface-variant bg-surface-elevated hover:bg-border-dim disabled:opacity-40 transition-colors"
              >
                {t(locale, "common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isPending || !url.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest kinetic-gradient text-on-primary disabled:opacity-40"
              >
                {isPending
                  ? t(locale, "matches.addByUrlAdding")
                  : t(locale, "matches.addByUrlSubmit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
