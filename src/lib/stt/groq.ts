import type { WhisperVerboseJson } from './postprocess';

function requireGroqKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY environment variable is required for Groq STT');
  return key;
}

const GROQ_API_KEY = requireGroqKey();

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

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API ${res.status}: ${errText}`);
  }

  return res.json() as Promise<WhisperVerboseJson>;
}
