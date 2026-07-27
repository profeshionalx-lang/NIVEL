/**
 * Собирает транскрипт с таймкодами по сегментам STT для LLM-анализа.
 *
 * Формат строки: `[start–end] текст` — секунды с одним знаком после точки,
 * без mm:ss, чтобы модель копировала число, а не пыталась его пересчитать.
 * Используется вместо raw_text там, где нужны таймкоды моментов "до/после".
 *
 * Сегменты никогда не выбрасываются (иначе теряем возможные моменты). Если
 * суммарный размер транскрипта превышает лимит — урезаем текст отдельных
 * сегментов, а не сами сегменты.
 */

import type { ProcessedSegment } from "@/lib/stt/postprocess";

/** Мягкий лимит символов итогового транскрипта. Модели на free-tier чувствительны к длине контекста. */
const MAX_TRANSCRIPT_CHARS = 24_000;
/** Минимальная длина текста сегмента после урезания — не резать в труху. */
const MIN_SEGMENT_TEXT_CHARS = 20;

function formatSeconds(n: number): string {
  return n.toFixed(1);
}

function formatLine(segment: ProcessedSegment): string {
  return `[${formatSeconds(segment.start)}–${formatSeconds(segment.end)}] ${segment.text}`;
}

/**
 * Строит timecoded-транскрипт из сегментов. Если результат превышает
 * MAX_TRANSCRIPT_CHARS, урезает текст самых длинных сегментов (сохраняя все
 * сегменты и их таймкоды) пока не впишется в лимит.
 */
export function buildTimecodedTranscript(segments: ProcessedSegment[]): string {
  if (segments.length === 0) return "";

  let working = segments.map((s) => ({ ...s }));
  let text = working.map(formatLine).join("\n");

  while (text.length > MAX_TRANSCRIPT_CHARS) {
    // Находим самый длинный (по тексту) сегмент, который ещё можно урезать.
    let idx = -1;
    let maxLen = MIN_SEGMENT_TEXT_CHARS;
    for (let i = 0; i < working.length; i++) {
      if (working[i].text.length > maxLen) {
        maxLen = working[i].text.length;
        idx = i;
      }
    }
    if (idx === -1) break; // всё уже урезано до минимума, дальше не сжать

    const seg = working[idx];
    const targetLen = Math.max(MIN_SEGMENT_TEXT_CHARS, Math.floor(seg.text.length * 0.8));
    working[idx] = { ...seg, text: seg.text.slice(0, targetLen).trimEnd() + "…" };
    text = working.map(formatLine).join("\n");
  }

  if (text.length > MAX_TRANSCRIPT_CHARS) {
    console.warn(
      `[timecodedTranscript] транскрипт всё ещё превышает лимит после урезания: ${text.length} символов, ${working.length} сегментов`
    );
  }

  return text;
}
