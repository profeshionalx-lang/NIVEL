"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pasteInsightsFromClaude } from "@/lib/actions/aiInsights";

const FORMAT_EXAMPLE = `## Карточка 1
- Тема: техника
- Заголовок: Поздний замах при бандеха
- Описание: Начинай замах когда мяч ещё летит — на 0.5 сек раньше.
- Цитата: "ты опять поздно взял"

## Карточка 2
- Тема: тактика
- Заголовок: Держи позицию у сетки
- Описание: После удара смещайся к сетке, не оставайся у задней линии.
- Цитата: «не стой сзади, иди вперёд»`;

const PROMPT_TEMPLATE = `Ты помогаешь тренеру по паделю. Прочитай транскрипт тренировки во вложении и выдели практические инсайты для ученика.

ВЫВЕДИ РЕЗУЛЬТАТ СТРОГО В ЭТОМ ФОРМАТЕ (никаких таблиц, нумерации, bold-выделений):

## Карточка 1
- Тема: техника
- Заголовок: <короткий совет, до 80 знаков>
- Описание: <конкретное действие, до 400 знаков>
- Цитата: "<дословная фраза из транскрипта>"

## Карточка 2
- Тема: тактика
- Заголовок: ...
- Описание: ...
- Цитата: "..."

ПРАВИЛА:
- Тема обязательно одна из: техника, тактика, физика, ментал (строчные буквы)
- Минимум 5, максимум 15 карточек
- В каждой карточке цитата — дословная фраза из транскрипта (без неё инсайт невалиден)
- Только actionable советы, не пересказ
- Никакого markdown-форматирования внутри полей (**bold**, *italic* и т.п.)
- Никаких таблиц, нумерованных списков, заголовков # или ###`;

export function PasteInsightsButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = PROMPT_TEMPLATE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleSubmit() {
    if (!markdown.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await pasteInsightsFromClaude(sessionId, markdown);
      if ("error" in result) {
        setError(result.line ? `Строка ${result.line}: ${result.error}` : result.error);
      } else {
        setMarkdown("");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function handleClose() {
    if (isPending) return;
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-2xl bg-surface-card border border-border-dim p-4 text-left active:scale-[0.98] transition-transform"
      >
        <span className="material-symbols-outlined text-primary">content_paste</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-on-surface">Вставить инсайты</p>
          <p className="text-xs text-on-surface-variant mt-0.5">Скопируйте ответ Claude и вставьте сюда</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center"
          onClick={handleClose}
        >
          <div
            className="bg-surface-card rounded-t-3xl w-full max-w-[430px] mx-auto p-6 space-y-4 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight">Вставить инсайты от Claude</h3>
              <button
                onClick={handleClose}
                aria-label="Закрыть"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-surface-elevated text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <button
              onClick={copyPrompt}
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border-dim text-sm font-bold text-on-surface min-h-[44px] active:scale-[0.98] transition-transform"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Промпт скопирован" : "Скопировать промпт-шаблон"}
            </button>

            <textarea
              value={markdown}
              onChange={(e) => {
                setMarkdown(e.target.value);
                setError(null);
              }}
              placeholder="Вставьте markdown-ответ от Claude…"
              rows={8}
              autoFocus
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none min-h-[200px]"
            />

            <details className="text-xs text-on-surface-variant">
              <summary className="cursor-pointer font-bold select-none">Ожидаемый формат</summary>
              <pre className="mt-2 bg-surface-elevated rounded-xl p-3 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words font-mono border border-border-dim">
                {FORMAT_EXAMPLE}
              </pre>
            </details>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 rounded-xl p-3 break-words">{error}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={isPending || !markdown.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40 min-h-[44px]"
              >
                {isPending ? "Создаём…" : "Создать карточки"}
              </button>
              <button
                onClick={handleClose}
                disabled={isPending}
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface min-h-[44px] disabled:opacity-40"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
