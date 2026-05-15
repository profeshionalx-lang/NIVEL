"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

interface Props {
  activeTab: "upcoming" | "past";
  locale: Locale;
}

export default function MatchesTabs({ activeTab, locale }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function switchTab(tab: "upcoming" | "past") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex rounded-2xl bg-surface-elevated p-1 gap-1">
      {(["upcoming", "past"] as const).map((tab) => {
        const isActive = activeTab === tab;
        const label =
          tab === "upcoming"
            ? t(locale, "matches.tabUpcoming")
            : t(locale, "matches.tabPast");
        return (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${
              isActive
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
