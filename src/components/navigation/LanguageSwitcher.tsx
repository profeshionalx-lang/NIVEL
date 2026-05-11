"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";
import type { Locale } from "@/lib/i18n/dict";

const OPTIONS: { value: Locale; label: string }[] = [
  { value: "ru", label: "RU" },
  { value: "en", label: "EN" },
];

export default function LanguageSwitcher({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2 pt-8 pb-6 text-on-surface-variant">
      <div className="inline-flex rounded-full bg-surface-low p-1">
        {OPTIONS.map((o) => {
          const active = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              disabled={pending || active}
              onClick={() => startTransition(() => setLocale(o.value))}
              className={
                "px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest transition-colors " +
                (active
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant active:bg-surface-card")
              }
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
