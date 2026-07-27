/**
 * Серверная подстраховка над таймкодами моментов "до"/"после", которые LLM
 * может вернуть в полях "Момент до"/"Момент после" (см. parseInsights.ts).
 *
 * Модель галлюцинирует числа, поэтому эти поля — не единственный источник:
 * Цитата в формате карточки обязательна уже сегодня, и если её можно найти в
 * сегментах транскрипта, её начало — надёжный fallback для "Момент до".
 */

import type { ProcessedSegment } from "@/lib/stt/postprocess";

export interface NormalizeMomentsInput {
  momentBefore: number | null;
  momentAfter: number | null;
  quote: string;
  segments: ProcessedSegment[];
  durationSeconds: number | null;
}

export interface NormalizedMoments {
  momentBeforeSeconds: number | null;
  momentAfterSeconds: number | null;
}

/** Максимальное расхождение (сек) между заявленным "Момент до" и стартом сегмента цитаты, после которого мы доверяем цитате, а не модели. */
const QUOTE_DRIFT_TOLERANCE_SECONDS = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** lower-case + ё→е + стрип пунктуации, для нечувствительного к форматированию сравнения. */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalizeForMatch(s).split(" ").filter(Boolean);
}

/**
 * Ищет сегмент, чей текст содержит цитату (после нормализации). Если точного
 * вхождения нет — берёт сегмент с наибольшим покрытием токенов цитаты.
 * Возвращает null, если совпадений вообще нет (пустая цитата, пустые сегменты).
 */
function findQuoteSegment(quote: string, segments: ProcessedSegment[]): ProcessedSegment | null {
  const normalizedQuote = normalizeForMatch(quote);
  if (!normalizedQuote || segments.length === 0) return null;

  for (const seg of segments) {
    if (normalizeForMatch(seg.text).includes(normalizedQuote)) {
      return seg;
    }
  }

  const quoteTokens = new Set(tokenize(quote));
  if (quoteTokens.size === 0) return null;

  let best: ProcessedSegment | null = null;
  let bestScore = 0;

  for (const seg of segments) {
    const segTokens = tokenize(seg.text);
    if (segTokens.length === 0) continue;
    const overlap = segTokens.filter((t) => quoteTokens.has(t)).length;
    // Покрытие относительно длины цитаты — так длинные сегменты со случайным
    // одним совпавшим словом не выигрывают у короткого точного совпадения.
    const score = overlap / quoteTokens.size;
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  }

  return bestScore > 0 ? best : null;
}

/**
 * Нормализует пару моментов "до"/"после" для одной карточки:
 * - clamp в [0, durationSeconds] (если известна длительность);
 * - если before > after — after отбрасывается (некорректный порядок, доверять нечему);
 * - fallback по цитате: если momentBefore отсутствует, либо отстоит от
 *   старта сегмента с цитатой больше чем на QUOTE_DRIFT_TOLERANCE_SECONDS —
 *   берём старт сегмента цитаты вместо (или взамен) значения от модели.
 */
export function normalizeMoments(input: NormalizeMomentsInput): NormalizedMoments {
  const { quote, segments, durationSeconds } = input;
  let before = input.momentBefore;
  let after = input.momentAfter;

  const quoteSegment = findQuoteSegment(quote, segments);
  const quoteStart = quoteSegment?.start ?? null;

  if (quoteStart !== null) {
    if (before === null || Math.abs(before - quoteStart) > QUOTE_DRIFT_TOLERANCE_SECONDS) {
      before = quoteStart;
    }
  }

  if (durationSeconds != null && durationSeconds > 0) {
    if (before !== null) before = clamp(before, 0, durationSeconds);
    if (after !== null) after = clamp(after, 0, durationSeconds);
  } else {
    if (before !== null) before = Math.max(0, before);
    if (after !== null) after = Math.max(0, after);
  }

  if (before !== null && after !== null && before > after) {
    after = null;
  }

  return { momentBeforeSeconds: before, momentAfterSeconds: after };
}
