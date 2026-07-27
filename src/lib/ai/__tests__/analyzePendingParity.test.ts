import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { INSIGHTS_PROMPT } from "@/lib/ai/insightsPrompt";
import { parseInsightsMarkdown } from "@/lib/ai/parseInsights";
import { buildTimecodedTranscript } from "@/lib/ai/timecodedTranscript";
import { normalizeMoments } from "@/lib/ai/moments";
import type { ProcessedSegment } from "@/lib/stt/postprocess";

/**
 * Прод-анализ идёт не через этот код, а через scripts/analyze-pending.mjs
 * (pm2-демон, spawnSync("claude", ...)) — чистый Node без сборки Next, TS
 * оттуда не импортировать. Скрипт поэтому дублирует SYSTEM_PROMPT и парсер;
 * дублирование уже расходилось один раз. Эти тесты — единственная защита от
 * повторного дрейфа: любое изменение промпта/парсера здесь без переноса в
 * скрипт должно ронять CI.
 */

const SCRIPT_PATH = new URL("../../../../scripts/analyze-pending.mjs", import.meta.url);
const scriptSource = readFileSync(SCRIPT_PATH, "utf8");

function extractSystemPrompt(source: string): string {
  const match = source.match(/export const SYSTEM_PROMPT = `([\s\S]*?)`;/);
  if (!match) throw new Error("Не удалось найти SYSTEM_PROMPT в scripts/analyze-pending.mjs");
  return match[1];
}

const FIXTURE_WITH_MOMENTS = `## Карточка 1
- Тема: техника
- Заголовок: Поздний замах при бандеха
- Описание: Начинай замах когда мяч ещё летит — на 0.5 сек раньше.
- Цитата: "ты опять поздно взял"
- Момент до: 412.5
- Момент после: 430.0

## Карточка 2
- Тема: тактика
- Заголовок: Держи позицию у сетки
- Описание: После удара смещайся к сетке, не оставайся у задней линии.
- Цитата: "не стой сзади, иди вперёд"
- Момент до: 12
- Момент после: 20`;

const FIXTURE_WITHOUT_MOMENTS = `## Карточка 1
- Тема: физика
- Заголовок: Дыхание на ударе
- Описание: Выдыхай в момент удара, не задерживай дыхание.
- Цитата: "дыши ровнее"`;

const FIXTURE_WITH_UNKNOWN_FIELD = `## Карточка 1
- Тема: менталка
- Заголовок: Спокойствие после ошибки
- Описание: Не спеши со следующим ударом после промаха.
- Цитата: "успокойся"
- НеизвестноеПоле: мусор, который модель придумала сама`;

describe("scripts/analyze-pending.mjs — дрейф от src/lib/ai", () => {
  it("SYSTEM_PROMPT скрипта совпадает с INSIGHTS_PROMPT посимвольно", () => {
    expect(extractSystemPrompt(scriptSource)).toBe(INSIGHTS_PROMPT);
  });

  it("parseCards() скрипта даёт тот же результат, что parseInsightsMarkdown()", async () => {
    const script = await import(/* @vite-ignore */ SCRIPT_PATH.href);

    for (const fixture of [FIXTURE_WITH_MOMENTS, FIXTURE_WITHOUT_MOMENTS, FIXTURE_WITH_UNKNOWN_FIELD]) {
      const coreResult = parseInsightsMarkdown(fixture);
      expect(coreResult.ok).toBe(true);
      if (!coreResult.ok) throw new Error("unreachable");

      const scriptCards = script.parseCards(fixture);
      expect(scriptCards).toEqual(coreResult.cards);
    }
  });

  it("buildTimecodedTranscript() скрипта даёт тот же результат, что src/lib/ai/timecodedTranscript", async () => {
    const script = await import(/* @vite-ignore */ SCRIPT_PATH.href);

    const segments: ProcessedSegment[] = [
      { id: 0, start: 0, end: 5.2, text: "Начинаем разминку" },
      { id: 1, start: 412.5, end: 418.2, text: "ты опять поздно взял" },
      { id: 2, start: 430.0, end: 435.5, text: "вот теперь правильно" },
    ];

    expect(script.buildTimecodedTranscript(segments)).toBe(buildTimecodedTranscript(segments));
    expect(script.buildTimecodedTranscript([])).toBe(buildTimecodedTranscript([]));
  });

  it("normalizeMoments() скрипта даёт тот же результат, что src/lib/ai/moments", async () => {
    const script = await import(/* @vite-ignore */ SCRIPT_PATH.href);

    const segments: ProcessedSegment[] = [
      { id: 0, start: 10, end: 15, text: "ты опять поздно взял" },
      { id: 1, start: 400, end: 405, text: "вот теперь правильно" },
    ];

    const cases = [
      { momentBefore: 412.5, momentAfter: 430.0, quote: "ты опять поздно взял", segments, durationSeconds: 500 },
      { momentBefore: null, momentAfter: null, quote: "ты опять поздно взял", segments, durationSeconds: 500 },
      { momentBefore: 100, momentAfter: 50, quote: "не найдётся в сегментах", segments, durationSeconds: 500 },
      { momentBefore: -5, momentAfter: 9999, quote: "", segments, durationSeconds: null },
    ];

    for (const input of cases) {
      expect(script.normalizeMoments(input)).toEqual(normalizeMoments(input));
    }
  });
});
