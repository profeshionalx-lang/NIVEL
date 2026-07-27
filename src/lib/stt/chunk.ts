import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import type { WhisperSegment, WhisperVerboseJson } from "./postprocess";

/**
 * Target length of each chunk when splitting long recordings before sending
 * them to Groq. Chosen with margin: at Groq's real-world transcription speed
 * (much faster than realtime) an 8-minute chunk finishes in a few seconds, so
 * a 90-minute recording (~11 chunks) comfortably fits inside the route's
 * `maxDuration = 300` budget. See NIVEL#244.
 */
export const CHUNK_SECONDS = 480;

/**
 * Splits an audio buffer into sequential chunks of roughly `CHUNK_SECONDS`
 * each, using ffmpeg's segment muxer with stream copy (`-c copy`) — no
 * re-encode, so it's fast and lossless. Segment boundaries land on the
 * nearest keyframe/frame, not exactly at `CHUNK_SECONDS`; callers must read
 * each chunk's *actual* duration back from the transcription response rather
 * than assuming a fixed size (see `stitchWhisperResults`).
 */
export async function splitAudioIntoChunks(
  audioBuffer: Buffer,
  filename: string
): Promise<Buffer[]> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg binary is not available (ffmpeg-static failed to resolve)");
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "m4a";
  const dir = await mkdtemp(join(tmpdir(), "nivel-audio-"));
  const inputPath = join(dir, `input.${ext}`);
  const outputPattern = join(dir, `chunk-%04d.${ext}`);

  try {
    await writeFile(inputPath, audioBuffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(ffmpegPath as unknown as string, [
        "-y",
        "-i",
        inputPath,
        "-f",
        "segment",
        "-segment_time",
        String(CHUNK_SECONDS),
        "-reset_timestamps",
        "1",
        "-c",
        "copy",
        outputPattern,
      ]);

      let stderr = "";
      proc.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on("error", (err) => reject(err));
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      });
    });

    const files = (await readdir(dir)).filter((f) => f.startsWith("chunk-")).sort();

    if (files.length === 0) {
      throw new Error("ffmpeg produced no audio chunks");
    }

    return await Promise.all(files.map((f) => readFile(join(dir, f))));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Stitches sequential Whisper `verbose_json` responses (one per chunk) into a
 * single continuous transcript.
 *
 * Critical part: segments of chunk N>0 get their `start`/`end` shifted by the
 * cumulative *actual* duration of all prior chunks, and `id` is renumbered
 * sequentially across the whole recording. Insight-card moments (S2–S4) and
 * the Android frame scrubber (A6) key off these seconds — a wrong offset
 * means frames/cards point at the wrong place in the recording. See NIVEL#244.
 */
export function stitchWhisperResults(chunks: WhisperVerboseJson[]): WhisperVerboseJson {
  if (chunks.length === 0) {
    throw new Error("stitchWhisperResults: no chunks to stitch");
  }
  if (chunks.length === 1) return chunks[0];

  const segments: WhisperSegment[] = [];
  const texts: string[] = [];
  let offset = 0;
  let nextId = 0;

  for (const chunk of chunks) {
    for (const seg of chunk.segments) {
      segments.push({
        ...seg,
        id: nextId++,
        start: seg.start + offset,
        end: seg.end + offset,
      });
    }

    const text = chunk.text?.trim();
    if (text) texts.push(text);

    const chunkDuration = chunk.duration ?? chunk.segments.at(-1)?.end ?? 0;
    offset += chunkDuration;
  }

  return {
    task: chunks[0].task,
    language: chunks[0].language,
    duration: offset,
    text: texts.join(" "),
    segments,
  };
}
