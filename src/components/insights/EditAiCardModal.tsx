"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAiInsightCard } from "@/lib/actions/aiInsights";
import type { InsightCard } from "@/lib/types";

const TAGS = ["техника", "тактика", "физика", "ментал"] as const;

interface Props {
  card: InsightCard;
  onClose: () => void;
}

export function EditAiCardModal({ card, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(card.title || card.front_text);
  const [body, setBody] = useState(card.body || card.context_text || "");
  const [tag, setTag] = useState<string>(card.tags?.[0] ?? "техника");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isValid = title.trim().length > 0 && title.trim().length <= 80 &&
    body.trim().length > 0 && body.trim().length <= 400 &&
    TAGS.includes(tag as typeof TAGS[number]);

  function handleSave() {
    if (!isValid) return;
    setError(null);
    startTransition(async () => {
      const result = await updateAiInsightCard(card.id, {
        title: title.trim(),
        body: body.trim(),
        tag,
      });
      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 space-y-4 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black tracking-tight">Редактировать карточку</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Заголовок <span className="text-on-surface-variant/50">({title.trim().length}/80)</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            autoFocus
            className="w-full bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Описание <span className="text-on-surface-variant/50">({body.trim().length}/400)</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            rows={4}
            className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface resize-none border border-border-dim focus:border-primary focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
            Тема
          </label>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="w-full bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-on-surface border border-border-dim focus:border-primary focus:outline-none"
          >
            {TAGS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {card.quote && (
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
              Цитата (не редактируется)
            </p>
            <p className="rounded-xl bg-surface-elevated p-3 text-xs text-on-surface-variant italic border-l-2 border-primary/40">
              «{card.quote}»
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-xl p-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={isPending || !isValid}
            className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40 min-h-[44px]"
          >
            {isPending ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface min-h-[44px] disabled:opacity-40"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
