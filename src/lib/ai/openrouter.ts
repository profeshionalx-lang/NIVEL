/**
 * Вызов LLM через OpenRouter (OpenAI-совместимый chat-completions API)
 * для анализа транскрипта тренировки и извлечения insight-карточек.
 *
 * Без SDK — нативный fetch + AbortController, по образцу src/lib/stt/groq.ts.
 * Модель конфигурируется через env INSIGHTS_MODEL (точка переключения для
 * будущего сравнительного эксперимента между моделями).
 */

import { buildInsightsMessages } from "./insightsPrompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_INSIGHTS_MODEL = "z-ai/glm-4.5-air:free";
const OPENROUTER_TIMEOUT_MS = 240_000;

function getInsightsModel(): string {
  return process.env.INSIGHTS_MODEL?.trim() || DEFAULT_INSIGHTS_MODEL;
}

function requireOpenRouterKey(): string {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error("OPENROUTER_API_KEY не задан — анализ транскриптов недоступен");
  }
  return key;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Прогоняет текст транскрипта через LLM и возвращает сырой markdown-ответ.
 * Парсинг markdown в карточки — отдельно, через parseInsightsMarkdown.
 */
export async function generateInsightsRaw(transcript: string): Promise<string> {
  const apiKey = requireOpenRouterKey();
  const model = getInsightsModel();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Nivel Padel Coaching",
      },
      body: JSON.stringify({
        model,
        messages: buildInsightsMessages(transcript),
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenRouter API ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as ChatCompletionResponse;
    const content = json.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error(`Модель ${model} вернула пустой ответ`);
    }

    return content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenRouter API timed out after ${OPENROUTER_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
