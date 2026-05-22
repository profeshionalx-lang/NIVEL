"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { generateAiInsights } from "@/lib/actions/aiInsights";
import { getTranscriptStatus } from "@/lib/actions/audio";

interface Props {
  sessionId: string;
  /** Статус транскрипта — компонент активен только при "ready". */
  transcriptStatus: string;
  initialAnalysisStatus: string;
  initialAnalysisError: string | null;
}

/**
 * Состояние автоматического LLM-анализа транскрипта.
 * Когда транскрипт готов, а анализ ещё не запускался — триггерит его сам.
 * Поллит результат и подтягивает свежие карточки через router.refresh().
 */
export function InsightsAnalysisStatus({
  sessionId,
  transcriptStatus,
  initialAnalysisStatus,
  initialAnalysisError,
}: Props) {
  const router = useRouter();
  // Если анализ ещё не запускался, а транскрипт готов — он будет запущен
  // автотриггером ниже, поэтому сразу показываем "processing".
  const willAutoTrigger =
    transcriptStatus === "ready" && initialAnalysisStatus === "idle";
  const [status, setStatus] = useState(
    willAutoTrigger ? "processing" : initialAnalysisStatus
  );
  const [error, setError] = useState<string | null>(initialAnalysisError);
  const [, startTransition] = useTransition();
  const triggered = useRef(false);

  // Запускает анализ на сервере и отражает результат в локальном состоянии.
  const performAnalysis = useCallback(() => {
    triggered.current = true;
    startTransition(async () => {
      const result = await generateAiInsights(sessionId);
      if ("error" in result) {
        setStatus("failed");
        setError(result.error);
      } else {
        setStatus("ready");
        setError(null);
        router.refresh();
      }
    });
  }, [sessionId, router]);

  // Ручной перезапуск (кнопки «Повторить» / «Перегенерировать»).
  const restartAnalysis = useCallback(() => {
    setStatus("processing");
    setError(null);
    performAnalysis();
  }, [performAnalysis]);

  // Автотриггер: транскрипт готов, анализ ещё ни разу не запускался.
  useEffect(() => {
    if (triggered.current) return;
    if (willAutoTrigger) performAnalysis();
  }, [willAutoTrigger, performAnalysis]);

  // Поллинг: подхватываем результат, если анализ запущен в другой вкладке
  // или продолжается на сервере после перезагрузки страницы.
  useEffect(() => {
    if (status !== "processing") return;
    const intervalId = setInterval(async () => {
      const result = await getTranscriptStatus(sessionId);
      if (!result) return;
      if (result.analysis_status === "ready" || result.analysis_status === "failed") {
        clearInterval(intervalId);
        setStatus(result.analysis_status);
        setError(result.analysis_error);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [sessionId, status, router]);

  if (transcriptStatus !== "ready") return null;

  if (status === "idle" || status === "processing") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-card p-4 border border-border-dim">
        <span
          className="material-symbols-outlined text-primary"
          style={{ animation: "spin 2s linear infinite" }}
        >
          autorenew
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-on-surface">ИИ анализирует транскрипт…</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Карточки появятся автоматически
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-2xl bg-surface-card p-4 border border-red-500/40 space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-red-400">error</span>
          <p className="text-sm font-bold text-on-surface">Не удалось проанализировать</p>
        </div>
        {error && (
          <p className="text-xs text-on-surface-variant break-words font-mono">{error}</p>
        )}
        <button
          onClick={restartAnalysis}
          className="w-full py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary min-h-[44px] active:scale-[0.98] transition-transform"
        >
          Повторить анализ
        </button>
      </div>
    );
  }

  // status === "ready"
  return (
    <button
      onClick={restartAnalysis}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border-dim text-sm font-bold text-on-surface min-h-[44px] active:scale-[0.98] transition-transform"
    >
      <span className="material-symbols-outlined text-base">autorenew</span>
      Перегенерировать инсайты
    </button>
  );
}
