"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestAudioUploadUrl, transcribeSession, getTranscriptStatus } from "@/lib/actions/audio";

type UploadState = "idle" | "compressing" | "uploading" | "processing" | "done" | "error";

const AUDIO_EXTS = new Set(["m4a", "mp3", "wav", "ogg", "webm", "mp4", "aac", "opus"]);

async function compressAudio(file: File): Promise<File> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");

  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  const targetRate = 16000;
  let offlineCtx: OfflineAudioContext;
  try {
    offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * targetRate),
      targetRate
    );
  } catch {
    // Safari < 14.5 не поддерживает произвольный sampleRate
    offlineCtx = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * decoded.sampleRate),
      decoded.sampleRate
    );
  }
  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start();
  const rendered = await offlineCtx.startRendering();

  const pcm = rendered.getChannelData(0);
  const int16 = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32767));
  }

  const encoder = new Mp3Encoder(1, rendered.sampleRate, 16);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < int16.length; i += blockSize) {
    const buf = encoder.encodeBuffer(int16.subarray(i, i + blockSize));
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));

  return new File(chunks.map((c) => c.buffer as ArrayBuffer), "audio.mp3", { type: "audio/mpeg" });
}

export function AudioUploader({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const router = useRouter();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!file.type.startsWith("audio/") && !AUDIO_EXTS.has(ext)) {
      setErrorMsg("Только аудио-файлы (m4a, mp3, wav…)");
      setState("error");
      return;
    }
    if (file.size > 150 * 1024 * 1024) {
      setErrorMsg("Файл слишком большой — максимум 150 MB (~90 мин). Сожмите аудио перед загрузкой.");
      setState("error");
      return;
    }

    let uploadFile = file;
    if (file.size > 20 * 1024 * 1024) {
      setState("compressing");
      try {
        uploadFile = await compressAudio(file);
      } catch (err: unknown) {
        setState("error");
        setErrorMsg(err instanceof Error ? err.message : "Ошибка при сжатии аудио");
        return;
      }
    }

    setState("uploading");
    setProgress(0);
    setErrorMsg("");

    const uploadExt = uploadFile.name.split(".").pop()?.toLowerCase() ?? "mp3";
    const urlResult = await requestAudioUploadUrl(sessionId, uploadExt);
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
        xhr.setRequestHeader("Content-Type", uploadFile.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload failed (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Сетевая ошибка при загрузке"));
        xhr.send(uploadFile);
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

    // Транскрипция теперь ставится в очередь и выполняется фоновым
    // pm2-процессом (см. scripts/transcribe-pending.ts) — поллим статус
    // вместо ожидания синхронного ответа.
    await pollTranscriptUntilDone(sessionId);
  }

  async function pollTranscriptUntilDone(sessionId: string) {
    while (mountedRef.current) {
      const status = await getTranscriptStatus(sessionId);
      if (!mountedRef.current) return;
      if (status?.status === "ready") {
        setState("done");
        router.refresh();
        return;
      }
      if (status?.status === "failed") {
        setState("error");
        setErrorMsg(status.error_message ?? "Ошибка транскрипции");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
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
        <p className="text-sm font-bold text-primary">Транскрипция готова</p>
        <p className="text-xs text-on-surface-variant">Анализ карточек скоро появится ниже.</p>
      </div>
    );
  }

  const isActive = state === "compressing" || state === "uploading" || state === "processing";

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
              Перетащите файл или нажмите · m4a, mp3, wav · до 150 MB · большие файлы сжимаются автоматически
            </p>
          </>
        )}

        {state === "compressing" && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-on-surface">Сжимаем аудио…</p>
            <p className="text-xs text-on-surface-variant">Займёт несколько секунд, не закрывайте вкладку</p>
          </div>
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
            <p className="text-sm font-bold text-on-surface">Транскрибируем аудио…</p>
            <p className="text-xs text-on-surface-variant">
              Обычно 1–2 минуты, для длинных записей может занять дольше — можно закрыть вкладку
            </p>
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
