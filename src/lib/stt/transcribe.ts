import { transcribeAudio } from "./groq";
import { splitAudioIntoChunks, stitchWhisperResults } from "./chunk";
import type { WhisperVerboseJson } from "./postprocess";

/**
 * Groq's per-file upload limit is 25 MB on the free tier / 100 MB on dev tier.
 * We don't know which tier the configured key is on, so default to the
 * conservative (free-tier) limit — worst case we chunk a bit more than
 * strictly necessary, which is cheap; best case we avoid a silent 413 from
 * Groq. Override via GROQ_MAX_UPLOAD_MB if the key is confirmed dev tier.
 */
const DEFAULT_MAX_UPLOAD_MB = 24;

/**
 * Hard ceiling on what we'll even attempt to process. Above this, something
 * is almost certainly wrong with the upload (wrong file, corrupt recording)
 * rather than "just a long training session" — fail fast with a clear reason
 * instead of spending minutes splitting/transcribing a huge file.
 */
const ABSOLUTE_MAX_BYTES = 250 * 1024 * 1024;

export function getMaxUploadBytes(): number {
  const mb = Number(process.env.GROQ_MAX_UPLOAD_MB);
  return (Number.isFinite(mb) && mb > 0 ? mb : DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024;
}

function formatMb(bytes: number): string {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

/**
 * Transcribes an audio buffer via Groq, transparently splitting it into
 * sequential chunks when it's too large for a single request. Chunks are
 * transcribed one after another (not in parallel) to respect Groq rate
 * limits and keep the route's `maxDuration` budget predictable, then
 * stitched back into one continuous transcript (see `stitchWhisperResults`).
 *
 * On chunk failure we fail the whole transcription with a message that
 * identifies which part broke, rather than silently returning a partial
 * transcript — the `transcripts` table only models `ready`/`failed`, so a
 * half-finished result would look indistinguishable from a complete one.
 */
export async function transcribeAudioChunked(
  audioBuffer: Buffer,
  filename: string
): Promise<WhisperVerboseJson> {
  if (audioBuffer.length > ABSOLUTE_MAX_BYTES) {
    throw new Error(
      `Файл слишком большой для обработки (${formatMb(audioBuffer.length)}, максимум ${formatMb(ABSOLUTE_MAX_BYTES)}). Проверьте запись — это не похоже на обычную тренировку.`
    );
  }

  const maxBytes = getMaxUploadBytes();

  if (audioBuffer.length <= maxBytes) {
    return transcribeAudio(audioBuffer, filename);
  }

  let chunks: Buffer[];
  try {
    chunks = await splitAudioIntoChunks(audioBuffer, filename);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Аудио слишком большое для одной отправки (${formatMb(audioBuffer.length)}) и не удалось разбить на части: ${message}`
    );
  }

  const oversizedIndex = chunks.findIndex((c) => c.length > maxBytes);
  if (oversizedIndex !== -1) {
    throw new Error(
      `Не получилось разбить аудио на части подходящего размера (часть ${oversizedIndex + 1} из ${chunks.length} весит ${formatMb(chunks[oversizedIndex].length)}, лимит ${formatMb(maxBytes)}) — проверьте битрейт записи`
    );
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "m4a";
  const results: WhisperVerboseJson[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      results.push(await transcribeAudio(chunks[i], `chunk-${i}.${ext}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Не удалось транскрибировать часть ${i + 1} из ${chunks.length}: ${message}`);
    }
  }

  return stitchWhisperResults(results);
}
