"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getTranscriptStatus } from "@/lib/actions/audio";
import { createInsightCard, setTrainerCardStatus } from "@/lib/actions/insightCards";

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
  const [selection, setSelection] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [insightText, setInsightText] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "processing") return;
    const intervalId = setInterval(async () => {
      const result = await getTranscriptStatus(sessionId);
      if (result?.status === "ready" || result?.status === "failed") {
        clearInterval(intervalId);
        router.refresh();
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [sessionId, status, router]);

  useEffect(() => {
    if (status !== "ready") return;
    function onSelectionChange() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || !containerRef.current) {
        setSelection("");
        return;
      }
      const anchor = sel?.anchorNode;
      if (anchor && containerRef.current.contains(anchor)) {
        setSelection(text);
      } else {
        setSelection("");
      }
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [status]);

  function openModal() {
    setInsightText("");
    setCreateError(null);
    setShowModal(true);
  }

  function handleCreate() {
    if (!insightText.trim()) return;
    setCreateError(null);
    startTransition(async () => {
      const res = await createInsightCard(sessionId, {
        frontText: insightText,
        contextText: selection || null,
      });
      if (res.success) {
        await setTrainerCardStatus(res.id, "approved");
        setShowModal(false);
        setSelection("");
        window.getSelection()?.removeAllRanges();
        router.refresh();
      } else {
        setCreateError(res.error || "Не удалось создать карточку");
      }
    });
  }

  if (status === "processing") {
    return (
      <div className="rounded-3xl bg-surface-card p-6 text-center space-y-3">
        <span
          className="material-symbols-outlined text-4xl text-primary block"
          style={{ animation: "spin 2s linear infinite" }}
        >
          autorenew
        </span>
        <p className="text-sm font-bold text-on-surface">Транскрипция в процессе…</p>
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
    <>
      <div ref={containerRef}>
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

      {selection && !showModal && (
        <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-5 pointer-events-none">
          <button
            onClick={openModal}
            className="pointer-events-auto flex items-center gap-2 bg-primary text-on-primary px-5 py-3 rounded-2xl text-sm font-bold shadow-lg active:scale-95 transition-transform min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Создать инсайт из фрагмента
          </button>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface-card rounded-3xl p-6 w-full max-w-[430px] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black tracking-tight">Новая инсайт-карточка</h3>
            {selection && (
              <div className="rounded-xl bg-surface-elevated p-3 border-l-2 border-primary">
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-1">
                  Цитата
                </p>
                <p className="text-xs text-on-surface leading-relaxed">«{selection}»</p>
              </div>
            )}
            <textarea
              value={insightText}
              onChange={(e) => setInsightText(e.target.value)}
              placeholder="Главная мысль — одним предложением"
              rows={3}
              autoFocus
              className="w-full bg-surface-elevated rounded-xl p-3 text-sm text-on-surface placeholder-on-surface-variant/50 resize-none border border-border-dim focus:border-primary focus:outline-none"
            />
            {createError && (
              <p className="text-xs text-red-400 break-words">{createError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={isPending || !insightText.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm kinetic-gradient text-on-primary disabled:opacity-40 min-h-[44px]"
              >
                {isPending ? "Сохраняем…" : "Добавить"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-border-dim text-on-surface min-h-[44px]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
