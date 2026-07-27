import type { WhisperVerboseJson } from './postprocess';

function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY environment variable is required for Groq STT');
  return key;
}

const GROQ_API_KEY = requireGroqKey();

/**
 * Per-request timeout. Groq transcribes much faster than realtime (typically
 * seconds for an 8-minute chunk — see CHUNK_SECONDS in stt/chunk.ts), so this
 * is a fail-fast guard against a hung request, not the expected duration.
 * Long recordings are now sent as multiple sequential chunks within a single
 * route call (maxDuration=300, see stt/transcribe.ts) — a per-chunk timeout
 * anywhere near that budget would let one slow chunk starve all the others
 * and blow the route's own deadline instead of surfacing this error. NIVEL#244.
 */
const GROQ_TIMEOUT_MS = 60_000;

export async function transcribeAudio(
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
