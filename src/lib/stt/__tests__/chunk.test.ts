import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { describe, it, expect } from "vitest";
import { splitAudioIntoChunks, stitchWhisperResults } from "../chunk";
import type { WhisperVerboseJson } from "../postprocess";

const execFileAsync = promisify(execFile);

function chunk(
  text: string,
  segments: Array<{ id: number; start: number; end: number; text: string }>,
  duration?: number
): WhisperVerboseJson {
  return {
    task: "transcribe",
    language: "ru",
    duration,
    text,
    segments,
  };
}

describe("stitchWhisperResults", () => {
  it("passes a single chunk through unchanged", () => {
    const only = chunk("Привет мир", [{ id: 0, start: 0, end: 2, text: "Привет мир" }], 2);
    const result = stitchWhisperResults([only]);
    expect(result).toBe(only);
  });

  it("offsets start/end of the second chunk by the first chunk's actual duration", () => {
    const first = chunk(
      "Первый чанк",
      [
        { id: 0, start: 0, end: 3, text: "Первый" },
        { id: 1, start: 3, end: 6, text: "чанк" },
      ],
      480 // ffmpeg segment landed a bit past the 480s target, e.g. keyframe alignment
    );
    const second = chunk(
      "Второй чанк",
      [
        { id: 0, start: 0, end: 4, text: "Второй" },
        { id: 1, start: 4, end: 8, text: "чанк" },
      ],
      200
    );

    const result = stitchWhisperResults([first, second]);

    // Segment ids renumbered sequentially across the whole recording.
    expect(result.segments.map((s) => s.id)).toEqual([0, 1, 2, 3]);

    // First chunk's segments are untouched (offset 0).
    expect(result.segments[0]).toMatchObject({ start: 0, end: 3 });
    expect(result.segments[1]).toMatchObject({ start: 3, end: 6 });

    // Second chunk's segments are shifted by the first chunk's duration (480s),
    // not by the sum of its own segment ends (6s) — this is the whole point:
    // real chunk duration can differ from where the last transcribed word ended.
    expect(result.segments[2]).toMatchObject({ start: 480, end: 484 });
    expect(result.segments[3]).toMatchObject({ start: 484, end: 488 });

    expect(result.text).toBe("Первый чанк Второй чанк");
    expect(result.duration).toBe(680); // 480 + 200
  });

  it("stitches three chunks with cumulative offsets", () => {
    const chunks = [
      chunk("A", [{ id: 0, start: 0, end: 10, text: "A" }], 100),
      chunk("B", [{ id: 0, start: 0, end: 5, text: "B" }], 90),
      chunk("C", [{ id: 5, start: 1, end: 3, text: "C" }], 50),
    ];

    const result = stitchWhisperResults(chunks);

    expect(result.segments.map((s) => s.id)).toEqual([0, 1, 2]);
    expect(result.segments[0]).toMatchObject({ start: 0, end: 10 });
    expect(result.segments[1]).toMatchObject({ start: 100, end: 105 });
    // Third chunk offset by 100 + 90 = 190, regardless of the source segment's
    // own (chunk-local) id of 5.
    expect(result.segments[2]).toMatchObject({ start: 191, end: 193 });
    expect(result.duration).toBe(240); // 100 + 90 + 50
  });

  it("falls back to the last segment's end when a chunk has no duration field", () => {
    const first = chunk("A", [{ id: 0, start: 0, end: 7, text: "A" }]); // no duration
    const second = chunk("B", [{ id: 0, start: 0, end: 2, text: "B" }], 3);

    const result = stitchWhisperResults([first, second]);

    expect(result.segments[1]).toMatchObject({ start: 7, end: 9 });
  });

  it("throws on an empty chunk list", () => {
    expect(() => stitchWhisperResults([])).toThrow();
  });
});

describe("splitAudioIntoChunks (real ffmpeg)", () => {
  it("splits a real short audio file into a single valid chunk via ffmpeg stream copy", async () => {
    if (!ffmpegPath) {
      // ffmpeg-static failed to resolve a binary for this platform — skip
      // rather than fail the whole suite; the mocked orchestration tests in
      // transcribe.test.ts still cover the chunking/stitching logic.
      return;
    }

    // Generate a tiny synthetic mono WAV via ffmpeg's lavfi sine source —
    // avoids shipping a binary fixture just to prove the real ffmpeg spawn +
    // temp-file plumbing in splitAudioIntoChunks works end to end.
    const { stdout } = await execFileAsync(
      ffmpegPath,
      [
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-f",
        "wav",
        "pipe:1",
      ],
      { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 }
    );
    const audioBuffer = Buffer.from(stdout);
    expect(audioBuffer.length).toBeGreaterThan(0);

    const chunks = await splitAudioIntoChunks(audioBuffer, "tone.wav");

    // 2s input, CHUNK_SECONDS=480 → ffmpeg's segment muxer produces exactly
    // one output file, and it should still be valid, playable audio.
    expect(chunks).toHaveLength(1);
    expect(chunks[0].length).toBeGreaterThan(0);
  }, 15000);
});
