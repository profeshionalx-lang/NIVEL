import type { WhisperVerboseJson } from './postprocess';

function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY environment variable is required for Groq STT');
  return key;
}

const GROQ_API_KEY = requireGroqKey();

const GROQ_TIMEOUT_MS = 280_000;

// Ретраи только на транзиентные ошибки (429/5xx) — на 4xx (битый файл,
// неверный формат) ретрай бессмыслен, ошибка не исчезнет.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 2_000;

class GroqRetryableError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`Groq API ${status}: ${body}`);
    this.status = status;
  }
}

async function transcribeAudioOnce(
  audioBuffer: Buffer,
  filename: string
): Promise<WhisperVerboseJson> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(audioBuffer)]), filename);
  form.append('model', 'whisper-large-v3');
  form.append('language', 'ru');
  form.append('response_format', 'verbose_json');
  form.append('temperature', '0');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: form,
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      if (RETRYABLE_STATUS.has(res.status)) {
        throw new GroqRetryableError(res.status, errText);
      }
      throw new Error(`Groq API ${res.status}: ${errText}`);
    }

    return (await res.json()) as WhisperVerboseJson;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Groq API timed out after ${GROQ_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Транскрибирует аудио через Groq Whisper с ретраями на транзиентные ошибки
 * (429/5xx) — экспоненциальный backoff (2s, 4s). На 4xx или после исчерпания
 * попыток бросает исходную ошибку.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string
): Promise<WhisperVerboseJson> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await transcribeAudioOnce(audioBuffer, filename);
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof GroqRetryableError;
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
