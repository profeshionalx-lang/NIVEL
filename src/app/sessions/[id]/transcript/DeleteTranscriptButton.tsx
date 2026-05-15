"use client";

import { useTransition } from "react";
import { deleteTranscript } from "@/lib/actions/audio";

export function DeleteTranscriptButton({ sessionId }: { sessionId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Удалить транскрипт? Это действие нельзя отменить.")) return;
    startTransition(() => {
      void deleteTranscript(sessionId);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs text-red-400 font-bold uppercase tracking-wider disabled:opacity-50"
    >
      {isPending ? "Удаление…" : "Удалить транскрипт"}
    </button>
  );
}
