"use client";

import { useRef, useState } from "react";
import { requestAudioUploadUrl, transcribeSession } from "@/lib/actions/audio";

type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

export function AudioUploader({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith("audio/")) {
      setErrorMsg("Только аудио-файлы (m4a, mp3, wav…)");
      setState("error");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setErrorMsg("Файл слишком большой — максимум 100 MB");
      setState("error");
      return;
    }

    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "m4a";
    const urlResult = await requestAudioUploadUrl(sessionId, ext);
    if ("error" in urlResult) {
      setState("error");
      setErrorMsg(urlResult.error);
      return;
    }

    const { uploadUrl, storagePath } = urlResult;

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Сетевая ошибка при загрузке"));
        xhr.send(file);
      });
    } catch (err: unknown) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Ошибка загрузки");
      return;
    }

    setState("processing");
    const transcribeResult = await transcribeSession(sessionId, storagePath);
    if (!transcribeResult.success) {
      setState("error");
      setErrorMsg(transcribeResult.error ?? "Ошибка запуска транскрипции");
      return;
    }
    setState("done");
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
  }

  if (state === "done") {
    return (
      <div className="rounded-3xl bg-surface-card p-5 text-center space-y-1">
        <p className="text-sm font-bold text-primary">Аудио загружено — транскрипция запущена</p>
        <p className="text-xs text-on-surface-variant">Обычно занимает 15–30 секунд.</p>
      </div>
    );
  }

  const isActive = state === "uploading" || state === "processing";

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
        Аудио тренировки
      </p>
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !isActive && state !== "error" && inputRef.current?.click()}
        className={[
          "rounded-3xl border-2 border-dashed p-8 text-center transition-colors",
          state === "idle" ? "border-border-dim hover:border-primary/50 cursor-pointer" : "",
          state === "error" ? "border-red-500/40" : "",
          isActive ? "border-border-dim cursor-default" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onFileChange}
        />

        {state === "idle" && (
          <>
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2 block">
              audio_file
            </span>
            <p className="text-sm font-bold text-on-surface">Загрузить аудио</p>
            <p className="text-xs text-on-surface-variant mt-1">
              Перетащите файл или нажмите · m4a, mp3, wav · до 100 MB
            </p>
          </>
        )}

        {state === "uploading" && (
          <div className="space-y-3">
            <p className="text-sm font-bold text-on-surface">Загрузка… {progress}%</p>
            <div className="w-full bg-surface-high rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === "processing" && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-on-surface">Запускаем транскрипцию…</p>
            <p className="text-xs text-on-surface-variant">Это займёт 15–30 секунд</p>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-3">
            <span className="material-symbols-outlined text-3xl text-red-400 block">error</span>
            <p className="text-sm text-red-400">{errorMsg}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setState("idle");
                setErrorMsg("");
                setProgress(0);
              }}
              className="text-xs text-secondary font-bold uppercase tracking-wider"
            >
              Попробовать снова
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
