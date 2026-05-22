"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
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
 * Статус LLM-анализа транскрипта.
 * Анализ запускается внешним pm2-процессом (scripts/analyze-pending.mjs),
 * компонент только поллит результат и показывает статус / кнопку перегенерации.
 */
export function InsightsAnalysisStatus({
  sessionId,
  transcriptStatus,
  initialAnalysisStatus,
  initialAnalysisError,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialAnalysisStatus);
  const [error, setError] = useState<string | null>(initialAnalysisError);
  const [, startTransition] = useTransition();

  // Ручной перезапуск через кнопки «Повторить» / «Перегенерировать».
  const restartAnalysis = useCallback(() => {
    setStatus("processing");
    setError(null);
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

  // Поллинг: подхватываем результат от pm2-анализатора.
  useEffect(() => {
    if (status !== "processing" && status !== "idle") return;
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
    const label = status === "idle" ? "Анализ в очереди…" : "ИИ анализирует транскрипт…";
    const sub   = status === "idle" ? "Появится в течение 5 минут" : "Карточки появятся автоматически";
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-surface-card p-4 border border-border-dim">
        <span
          className="material-symbols-outlined text-primary"
          style={{ animation: "spin 2s linear infinite" }}
        >
          autorenew
        </span>
        <div className="flex-1">
          <p className="text-sm font-bold text-on-surface">{label}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>
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
