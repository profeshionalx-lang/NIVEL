import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { WhisperVerboseJson } from "../postprocess";

const transcribeAudioMock = vi.fn<(buf: Buffer, filename: string) => Promise<WhisperVerboseJson>>();
const splitAudioIntoChunksMock = vi.fn<(buf: Buffer, filename: string) => Promise<Buffer[]>>();

vi.mock("../groq", () => ({
  transcribeAudio: (...args: [Buffer, string]) => transcribeAudioMock(...args),
}));

vi.mock("../chunk", async () => {
  const actual = await vi.importActual<typeof import("../chunk")>("../chunk");
  return {
    ...actual,
    splitAudioIntoChunks: (...args: [Buffer, string]) => splitAudioIntoChunksMock(...args),
  };
});

// Import after mocks so the module under test picks up the mocked deps.
const { transcribeAudioChunked, getMaxUploadBytes } = await import("../transcribe");

function whisperResult(text: string, duration: number): WhisperVerboseJson {
  return {
    task: "transcribe",
    language: "ru",
    duration,
    text,
    segments: [{ id: 0, start: 0, end: duration, text }],
  };
}

describe("transcribeAudioChunked", () => {
  beforeEach(() => {
    transcribeAudioMock.mockReset();
    splitAudioIntoChunksMock.mockReset();
    delete process.env.GROQ_MAX_UPLOAD_MB;
  });

  afterEach(() => {
    delete process.env.GROQ_MAX_UPLOAD_MB;
  });

  it("sends small buffers directly to Groq without splitting", async () => {
    const buf = Buffer.alloc(1024);
    transcribeAudioMock.mockResolvedValue(whisperResult("hi", 5));

    const result = await transcribeAudioChunked(buf, "audio.m4a");

    expect(splitAudioIntoChunksMock).not.toHaveBeenCalled();
    expect(transcribeAudioMock).toHaveBeenCalledTimes(1);
    expect(transcribeAudioMock).toHaveBeenCalledWith(buf, "audio.m4a");
    expect(result.text).toBe("hi");
  });

  it("splits oversized buffers, transcribes each chunk sequentially, and stitches results", async () => {
    // First test to touch ffmpeg-static's binary-path resolution (via
    // vi.importActual on "../chunk") — that alone is slow enough in CI to
    // blow the default 5s timeout.
    process.env.GROQ_MAX_UPLOAD_MB = "1"; // 1 MB threshold for the test
    const buf = Buffer.alloc(2 * 1024 * 1024); // 2 MB — over threshold

    const chunkA = Buffer.alloc(512 * 1024);
    const chunkB = Buffer.alloc(512 * 1024);
    splitAudioIntoChunksMock.mockResolvedValue([chunkA, chunkB]);

    transcribeAudioMock
      .mockResolvedValueOnce(whisperResult("part one", 480))
      .mockResolvedValueOnce(whisperResult("part two", 120));

    const result = await transcribeAudioChunked(buf, "long.m4a");

    expect(splitAudioIntoChunksMock).toHaveBeenCalledWith(buf, "long.m4a");
    expect(transcribeAudioMock).toHaveBeenCalledTimes(2);
    expect(transcribeAudioMock).toHaveBeenNthCalledWith(1, chunkA, "chunk-0.m4a");
    expect(transcribeAudioMock).toHaveBeenNthCalledWith(2, chunkB, "chunk-1.m4a");

    expect(result.text).toBe("part one part two");
    expect(result.duration).toBe(600);
    expect(result.segments.map((s) => s.id)).toEqual([0, 1]);
    expect(result.segments[1].start).toBe(480); // offset by chunk A's actual duration
  }, 15000);

  it("fails with a clear message identifying which chunk broke, not a raw Groq error", async () => {
    process.env.GROQ_MAX_UPLOAD_MB = "1";
    const buf = Buffer.alloc(2 * 1024 * 1024);
    splitAudioIntoChunksMock.mockResolvedValue([
      Buffer.alloc(512 * 1024),
      Buffer.alloc(512 * 1024),
    ]);

    transcribeAudioMock
      .mockResolvedValueOnce(whisperResult("part one", 480))
      .mockRejectedValueOnce(new Error("Groq API 429: rate limited"));

    await expect(transcribeAudioChunked(buf, "long.m4a")).rejects.toThrow(/часть 2 из 2/);
  });

  it("throws a clear error (not a Groq 4xx) when the file is over the absolute ceiling", async () => {
    const huge = Buffer.alloc(1); // avoid actually allocating 250MB+ in the test
    Object.defineProperty(huge, "length", { value: 300 * 1024 * 1024 });

    await expect(transcribeAudioChunked(huge, "huge.m4a")).rejects.toThrow(/слишком большой/);
    expect(splitAudioIntoChunksMock).not.toHaveBeenCalled();
    expect(transcribeAudioMock).not.toHaveBeenCalled();
  });

  it("throws when a produced chunk is still over the size limit", async () => {
    process.env.GROQ_MAX_UPLOAD_MB = "1";
    const buf = Buffer.alloc(2 * 1024 * 1024);
    splitAudioIntoChunksMock.mockResolvedValue([Buffer.alloc(2 * 1024 * 1024)]);

    await expect(transcribeAudioChunked(buf, "long.m4a")).rejects.toThrow(/битрейт/);
    expect(transcribeAudioMock).not.toHaveBeenCalled();
  });

  it("getMaxUploadBytes defaults to 24MB and respects GROQ_MAX_UPLOAD_MB", () => {
    expect(getMaxUploadBytes()).toBe(24 * 1024 * 1024);
    process.env.GROQ_MAX_UPLOAD_MB = "80";
    expect(getMaxUploadBytes()).toBe(80 * 1024 * 1024);
  });
});
