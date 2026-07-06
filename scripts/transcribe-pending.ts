#!/usr/bin/env -S npx tsx
/**
 * Фоновый поллер: каждые 15 секунд проверяет Supabase на наличие
 * транскриптов со status='pending', скачивает аудио из Storage и
 * прогоняет через Groq Whisper (с ретраями на 429/5xx — см.
 * src/lib/stt/groq.ts).
 *
 * Раньше вся эта работа выполнялась синхронно внутри HTTP route handler'а
 * (POST /api/v1/sessions/{id}/transcribe и Server Action transcribeSession),
 * держа соединение открытым до 300с. Теперь оба входа только ставят
 * транскрипт в очередь (status='pending') и сразу отвечают — см.
 * enqueueTranscriptionCore в src/lib/core/audio.ts. Этот скрипт — тот же
 * pm2-поллер паттерн, что и scripts/analyze-pending.mjs (LLM-анализ
 * инсайтов), применённый к самому шагу STT.
 *
 * В отличие от analyze-pending.mjs (raw REST fetch, без TS-импортов), этот
 * скрипт запускается через tsx и напрямую импортирует продакшн-модули
 * (@/lib/core/audio, @/lib/stt/groq) — так корректировки глоссария и
 * пост-обработки транскрипта (src/lib/stt/glossary.ts,
 * src/lib/stt/postprocess.ts) не нужно дублировать вручную.
 *
 * Запуск: pm2 start "npx tsx scripts/transcribe-pending.ts" --name nivel-transcriber
 * Логи:   pm2 logs nivel-transcriber
 */

import { readFileSync } from "node:fs";

// ─── Загрузка .env.local (до импорта модулей, которые читают process.env) ──

const ENV_PATH = new URL("../.env.local", import.meta.url).pathname;
const envFile = readFileSync(ENV_PATH, "utf8");
for (const line of envFile.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  const [, key, rawValue] = match;
  if (process.env[key] !== undefined) continue;
  process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPA_URL || !SERVICE) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY отсутствуют в .env.local");
}
if (!process.env.GROQ_API_KEY) {
  throw new Error("GROQ_API_KEY отсутствует в .env.local");
}

const POLL_INTERVAL_MS = 15_000; // 15 секунд — транскрипция ощущается как "почти сразу"

// ─── Supabase REST (только для чтения очереди — сама транскрипция идёт через core) ──

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function getPendingTranscripts(): Promise<Array<{ session_id: string; storage_path: string }>> {
  const res = await fetch(
    `${SUPA_URL}/rest/v1/transcripts?status=eq.pending&storage_path=not.is.null&select=session_id,storage_path`,
    { headers }
  );
  return res.json();
}

function log(msg: string) {
  console.log(`${new Date().toISOString().slice(0, 19).replace("T", " ")} ${msg}`);
}

async function tick() {
  const pending = await getPendingTranscripts();
  if (!pending?.length) return;

  log(`Найдено ${pending.length} транскриптов в очереди`);

  // Ленивый импорт: createClient/runQueuedTranscriptionCore тянут за собой
  // Next.js-зависимости (@supabase/supabase-js — ок, но избегаем импорта на
  // старте скрипта на случай отсутствия env на момент import).
  const { createClient } = await import("@supabase/supabase-js");
  const { runQueuedTranscriptionCore } = await import("../src/lib/core/audio");
  const supabase = createClient(SUPA_URL, SERVICE);

  for (const row of pending) {
    if (!row.storage_path) continue;
    log(`[${row.session_id.slice(0, 8)}] Начинаю транскрипцию`);
    const t0 = Date.now();
    const result = await runQueuedTranscriptionCore(supabase, row.session_id, row.storage_path);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (result.success) {
      log(`[${row.session_id.slice(0, 8)}] Готово за ${elapsed}s`);
    } else {
      log(`[${row.session_id.slice(0, 8)}] ОШИБКА (${elapsed}s): ${result.error}`);
    }
  }
}

log("Nivel transcriber запущен. Проверка каждые 15 секунд.");

await tick();
setInterval(() => {
  tick().catch((err) => log(`Ошибка тика: ${err instanceof Error ? err.message : String(err)}`));
}, POLL_INTERVAL_MS);
