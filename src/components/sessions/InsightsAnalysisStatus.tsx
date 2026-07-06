"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { requeueAiInsights } from "@/lib/actions/aiInsights";
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

  // Экспоненциальный backoff для поллинга: 3с → 3с → 5с → 10с → 20с → 30с (cap).
  const POLL_INTERVALS = [3000, 3000, 5000, 10000, 20000, 30000];

  // Ручной перезапуск через кнопки «Повторить» / «Перегенерировать».
  // Ставим транскрипт в очередь — консольный Claude на машине тренера
  // (pm2-демон) подхватит его в течение ~5 минут. Результат ловим поллингом.
  const restartAnalysis = useCallback(() => {
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const result = await requeueAiInsights(sessionId);
      if ("error" in result) {
        setStatus("failed");
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }, [sessionId, router]);

  // Поллинг: подхватываем результат от pm2-анализатора.
  // Интервал растёт по мере ожидания (exponential backoff), чтобы не долбить сеть
  // при долгом анализе, но быстро реагировать в первые секунды.
  useEffect(() => {
    if (status !== "processing" && status !== "idle") return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;
    let attempt = 0;

    const poll = async () => {
      const result = await getTranscriptStatus(sessionId);
      if (cancelled) return;
      if (result && (result.analysis_status === "ready" || result.analysis_status === "failed")) {
        setStatus(result.analysis_status);
        setError(result.analysis_error);
        router.refresh();
        return;
      }
      const delay = POLL_INTERVALS[Math.min(attempt, POLL_INTERVALS.length - 1)];
      attempt += 1;
      timeoutId = setTimeout(poll, delay);
    };

    timeoutId = setTimeout(poll, POLL_INTERVALS[0]);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
