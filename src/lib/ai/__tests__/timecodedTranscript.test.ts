import { describe, it, expect } from "vitest";
import { buildTimecodedTranscript } from "../timecodedTranscript";
import type { ProcessedSegment } from "@/lib/stt/postprocess";

describe("buildTimecodedTranscript", () => {
  it("одна строка на сегмент, секунды с одним знаком после точки", () => {
    const segments: ProcessedSegment[] = [
      { id: 0, start: 412.5, end: 418.23, text: "ты опять поздно взял" },
      { id: 1, start: 418.4, end: 421.0, text: "вот так уже лучше" },
    ];
    const result = buildTimecodedTranscript(segments);
    expect(result).toBe(
      "[412.5–418.2] ты опять поздно взял\n[418.4–421.0] вот так уже лучше"
    );
  });

  it("пустой массив сегментов → пустая строка", () => {
    expect(buildTimecodedTranscript([])).toBe("");
  });

  it("не выбрасывает сегменты даже при большом суммарном размере — урезает текст", () => {
    const segments: ProcessedSegment[] = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      start: i * 10,
      end: i * 10 + 5,
      text: "довольно длинный сегмент текста которого много и он будет урезан при превышении лимита символов транскрипта для модели анализа".repeat(2),
    }));
    const result = buildTimecodedTranscript(segments);
    const lines = result.split("\n");
    expect(lines).toHaveLength(500);
    // Каждый таймкод должен присутствовать, т.е. ни один сегмент не потерян.
    expect(result).toContain("[0.0–5.0]");
    expect(result).toContain("[4990.0–4995.0]");
  });

  it("не содержит mm:ss формата во входе", () => {
    const segments: ProcessedSegment[] = [{ id: 0, start: 65, end: 70, text: "тест" }];
    const result = buildTimecodedTranscript(segments);
    expect(result).not.toMatch(/\d+:\d{2}/);
    expect(result).toBe("[65.0–70.0] тест");
  });
});
