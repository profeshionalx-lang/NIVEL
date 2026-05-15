"use client";

import { useRef, useState, useTransition } from "react";
import { saveReflection } from "@/lib/actions/playtomic";
import type { Locale } from "@/lib/i18n/dict";
import { t } from "@/lib/i18n/dict";

interface Props {
  matchId: string;
  initialValue: string;
  locale: Locale;
}

export default function ReflectionTextarea({
  matchId,
  initialValue,
  locale,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    setValue(next);
    setStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        await saveReflection(matchId, next);
        setStatus("saved");
      });
    }, 800);
  }

  const statusLabel =
    status === "saving" || isPending
      ? t(locale, "matches.detail.reflectionSaving")
      : status === "saved"
        ? t(locale, "matches.detail.reflectionSaved")
        : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-black uppercase tracking-widest text-on-surface">
          {t(locale, "matches.detail.reflection")}
        </p>
        {statusLabel && (
          <span className="text-[10px] text-on-surface-variant">{statusLabel}</span>
        )}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={t(locale, "matches.detail.reflectionPlaceholder")}
        rows={4}
        className="w-full bg-surface-card rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant resize-none border border-border-dim focus:outline-none focus:border-primary/60 transition-colors"
      />
    </div>
  );
}
