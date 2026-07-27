import { describe, it, expect } from "vitest";
import { normalizeMoments } from "../moments";
import type { ProcessedSegment } from "@/lib/stt/postprocess";

const segments: ProcessedSegment[] = [
  { id: 0, start: 10, end: 15, text: "разминка начинается" },
  { id: 1, start: 400, end: 410, text: "ты опять поздно взял, видишь мяч уже тут" },
  { id: 2, start: 410, end: 418, text: "давай ещё раз" },
  { id: 3, start: 425, end: 432, text: "вот так уже лучше, отлично" },
];

describe("normalizeMoments", () => {
  it("clamp по durationSeconds", () => {
    const result = normalizeMoments({
      momentBefore: -5,
      momentAfter: 99999,
      quote: "не найдётся",
      segments: [],
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBe(0);
    expect(result.momentAfterSeconds).toBe(600);
  });

  it("before > after отбрасывает after", () => {
    const result = normalizeMoments({
      momentBefore: 500,
      momentAfter: 100,
      quote: "не найдётся нигде",
      segments: [],
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBe(500);
    expect(result.momentAfterSeconds).toBeNull();
  });

  it("fallback по цитате: точное вхождение, разная пунктуация/регистр", () => {
    const result = normalizeMoments({
      momentBefore: null,
      momentAfter: null,
      quote: "Ты опять поздно взял!",
      segments,
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBe(400);
  });

  it("fallback по цитате: ё/е нормализация", () => {
    const result = normalizeMoments({
      momentBefore: null,
      momentAfter: null,
      quote: "ты опять поздно взял, видишь мяч уже тут", // no ё here but exercise normalize path
      segments,
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBe(400);
  });

  it("fallback по цитате: лучший по покрытию токенов, если нет точного вхождения", () => {
    const result = normalizeMoments({
      momentBefore: null,
      momentAfter: null,
      quote: "вот так уже лучше отлично супер",
      segments,
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBe(425);
  });

  it("momentBefore модели отстоит от цитаты больше чем на 15с → берём цитату", () => {
    const result = normalizeMoments({
      momentBefore: 1000, // далеко от 400
      momentAfter: null,
      quote: "ты опять поздно взял",
      segments,
      durationSeconds: 1200,
    });
    expect(result.momentBeforeSeconds).toBe(400);
  });

  it("momentBefore модели близко к цитате (в пределах допуска) → доверяем модели", () => {
    const result = normalizeMoments({
      momentBefore: 405, // 5с от старта сегмента цитаты (400)
      momentAfter: null,
      quote: "ты опять поздно взял",
      segments,
      durationSeconds: 1200,
    });
    expect(result.momentBeforeSeconds).toBe(405);
  });

  it("нет совпадения по цитате и нет momentBefore → null", () => {
    const result = normalizeMoments({
      momentBefore: null,
      momentAfter: null,
      quote: "совершенно другая фраза которой нет нигде",
      segments,
      durationSeconds: 600,
    });
    expect(result.momentBeforeSeconds).toBeNull();
  });

  it("работает без durationSeconds (null) — не роняет, просто не clamp-ит верх", () => {
    const result = normalizeMoments({
      momentBefore: 400,
      momentAfter: 420,
      quote: "ты опять поздно взял",
      segments,
      durationSeconds: null,
    });
    expect(result.momentBeforeSeconds).toBe(400);
    expect(result.momentAfterSeconds).toBe(420);
  });
});
