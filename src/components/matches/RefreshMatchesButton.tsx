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
      aria-label={isPending ? t(locale, "matches.refreshing") : t(locale, "matches.refresh")}
      title={isPending ? t(locale, "matches.refreshing") : t(locale, "matches.refresh")}
      className="flex items-center justify-center h-11 w-11 rounded-xl bg-surface-elevated text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors"
    >
      <span
        className={`material-symbols-outlined text-[20px] ${isPending ? "animate-spin" : ""}`}
      >
        refresh
      </span>
    </button>
  );
}
