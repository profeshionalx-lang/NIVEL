"use client";

export function DownloadTranscriptButton({
  sessionId,
  rawText,
}: {
  sessionId: string;
  rawText: string | null;
}) {
  function handleClick() {
    const text = rawText ?? "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${sessionId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-on-surface-variant border border-border-dim active:scale-95 transition-transform min-h-[44px]"
    >
      <span className="material-symbols-outlined text-base">download</span>
      Скачать транскрипт
    </button>
  );
}
