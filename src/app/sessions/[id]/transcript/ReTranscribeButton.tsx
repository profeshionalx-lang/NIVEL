"use client";

import { useState, useTransition } from "react";
import { resetTranscript } from "@/lib/actions/audio";

export function ReTranscribeButton({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await resetTranscript(sessionId);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant border border-border-dim active:scale-95 transition-transform min-h-[44px]"
      >
        <span className="material-symbols-outlined text-base">refresh</span>
        Перетранскрибировать
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-surface-card rounded-3xl p-6 w-full max-w-[430px] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black tracking-tight">Перетранскрибировать?</h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Аудиофайл не хранится — нужно загрузить его заново. Текущий транскрипт будет удалён.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary text-on-primary disabled:opacity-40 min-h-[44px]"
              >
                {isPending ? "Удаляем…" : "Загрузить заново"}
              </button>
              <button
                onClick={() => setOpen(false)}
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
