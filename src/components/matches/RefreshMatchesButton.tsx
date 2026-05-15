"use client";

import { useTransition } from "react";
import { refreshMatches } from "@/lib/actions/playtomic";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

interface Props {
  locale: Locale;
}

export default function RefreshMatchesButton({ locale }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    startTransition(async () => {
      await refreshMatches();
    });
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
    >
      <span
        className={`material-symbols-outlined text-[18px] ${isPending ? "animate-spin" : ""}`}
      >
        refresh
      </span>
      {isPending ? t(locale, "matches.refreshing") : t(locale, "matches.refresh")}
    </button>
  );
}
