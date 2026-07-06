"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTranscriptStatus } from "@/lib/actions/audio";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
}

interface Props {
  sessionId: string;
  status: string;
  errorMessage: string | null;
  rawText: string | null;
  segments: Segment[];
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function segClass(avg?: number): string {
  if (avg === undefined || avg === null) return "";
  if (avg < -1.0) return " border-l-2 border-red-400 bg-red-500/10 pl-2";
  if (avg < -0.6) return " border-l-2 border-yellow-400 bg-yellow-400/10 pl-2";
  return "";
}

export function TranscriptView({ sessionId, status, errorMessage, rawText, segments }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"segments" | "fulltext">("segments");

  useEffect(() => {
    if (status !== "processing" && status !== "pending") return;
    const intervalId = setInterval(async () => {
      const result = await getTranscriptStatus(sessionId);
      if (result?.status === "ready" || result?.status === "failed") {
        clearInterval(intervalId);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [sessionId, status, router]);

  if (status === "processing" || status === "pending") {
    return (
      <div className="rounded-3xl bg-surface-card p-6 text-center space-y-3">
        <span
          className="material-symbols-outlined text-4xl text-primary block"
          style={{ animation: "spin 2s linear infinite" }}
        >
          autorenew
        </span>
        <p className="text-sm font-bold text-on-surface">
          {status === "pending" ? "В очереди на транскрипцию…" : "Транскрипция в процессе…"}
        </p>
        <p className="text-xs text-on-surface-variant">Обновляется автоматически каждые 3 секунды</p>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-3xl bg-surface-card p-6 space-y-2">
        <p className="text-sm font-bold text-red-400">Ошибка транскрипции</p>
        {errorMessage && (
          <p className="text-xs text-on-surface-variant font-mono break-words">{errorMessage}</p>
        )}
        <p className="text-xs text-on-surface-variant mt-2">
          Удалите транскрипт и загрузите аудио заново.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {(["segments", "fulltext"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-colors min-h-[44px] ${
              tab === t
                ? "bg-primary text-on-primary"
                : "bg-surface-card text-on-surface-variant"
            }`}
          >
            {t === "segments" ? "По сегментам" : "Сплошной текст"}
          </button>
        ))}
      </div>

      {tab === "segments" && (
        <div className="space-y-1">
          {segments.length === 0 && (
            <p className="text-sm text-on-surface-variant">Сегменты недоступны.</p>
          )}
          {segments.map((seg) => (
            <div
              key={seg.id}
              className={`rounded-xl p-3 bg-surface-card${segClass(seg.avg_logprob)}`}
            >
              <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider mr-2 font-mono select-none">
                {fmtTime(seg.start)}
              </span>
              <span className="text-sm text-on-surface">{seg.text}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "fulltext" && (
        <div className="rounded-2xl bg-surface-card p-4 text-sm text-on-surface leading-relaxed whitespace-pre-wrap break-words">
          {rawText || "Текст недоступен."}
        </div>
      )}
    </div>
  );
}
