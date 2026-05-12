#!/usr/bin/env node
// Pilot транскрипции одного аудиофайла через Groq Whisper.
//
// Запуск:
//   GROQ_API_KEY=... node scripts/transcribe-pilot.mjs <путь-к-аудио>
//
// Опции через env:
//   MODEL=whisper-large-v3-turbo   (по умолчанию; альтернативы: whisper-large-v3)
//   LANGUAGE=ru                    (по умолчанию)
//   FORMAT=verbose_json            (verbose_json | text | srt | vtt)
//
// Результат: <basename>.transcript.txt и <basename>.transcript.json рядом с исходником.

import { readFile, writeFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const apiKey = process.env.GROQ_API_KEY;
const inputPath = process.argv[2];

if (!apiKey) {
  console.error("❌ GROQ_API_KEY не задан. Получи ключ на https://console.groq.com и запусти:");
  console.error("   GROQ_API_KEY=gsk_... node scripts/transcribe-pilot.mjs <файл>");
  process.exit(1);
}

if (!inputPath) {
  console.error("❌ Передай путь к аудиофайлу: node scripts/transcribe-pilot.mjs <файл>");
  process.exit(1);
}

const model = process.env.MODEL || "whisper-large-v3-turbo";
const language = process.env.LANGUAGE || "ru";
const format = process.env.FORMAT || "verbose_json";

// Промпт-словарь для Whisper. Важно: НЕ начинать с метки типа "Термины:" —
// Whisper склонен «протекать» начало промпта в транскрипт. Лучше дать естественную
// фразу с упоминанием слов в разных формах и склонениях.
const PADEL_PROMPT =
  "Тренер объясняет ученику технику игры в падел. На корте используются удары " +
  "бандеха, бандехой, вибора, виборой, смэш, ремате, чикита, чикитой, глоба, " +
  "лоб, форхенд, бэкхенд, волей, дроп. Игроки бьют ракеткой по мячу через сетку, " +
  "используют отскок от стекла, играют пала по аламбре, делают контра-парет и " +
  "дос-парет, выходят к сетке, защищают заднюю линию, ставят байт.";

const overridePrompt = process.env.PROMPT;
const promptToUse = overridePrompt ?? PADEL_PROMPT;

const stats = await stat(inputPath);
const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
console.log(`📁 Файл: ${basename(inputPath)} (${sizeMB} MB)`);
console.log(`🤖 Модель: ${model}, язык: ${language}`);

if (stats.size > 25 * 1024 * 1024) {
  console.warn(`⚠️  Файл >25MB — может не пройти на free tier Groq. Dev tier держит до 100MB.`);
}

const fileBuffer = await readFile(inputPath);
const fileBlob = new Blob([fileBuffer], { type: "audio/mp4" });

const form = new FormData();
form.append("file", fileBlob, basename(inputPath));
form.append("model", model);
form.append("language", language);
form.append("response_format", format);
form.append("prompt", promptToUse);
form.append("temperature", "0");

console.log("⏳ Отправляю в Groq...");
const startedAt = Date.now();

const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: form,
});

if (!res.ok) {
  const errText = await res.text();
  console.error(`❌ Groq API ${res.status}: ${errText}`);
  process.exit(1);
}

const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

const suffix = process.env.OUTPUT_SUFFIX || "transcript";
const dir = dirname(inputPath);
const stem = basename(inputPath, extname(inputPath));
const txtPath = join(dir, `${stem}.${suffix}.txt`);
const jsonPath = join(dir, `${stem}.${suffix}.json`);

if (format === "verbose_json") {
  const data = await res.json();
  await writeFile(jsonPath, JSON.stringify(data, null, 2), "utf8");
  await writeFile(txtPath, data.text ?? "", "utf8");
  const segments = Array.isArray(data.segments) ? data.segments.length : 0;
  const duration = typeof data.duration === "number" ? data.duration.toFixed(1) : "?";
  console.log(`✅ Готово за ${elapsed}s`);
  console.log(`   Длительность аудио: ${duration}s, сегментов: ${segments}`);
  console.log(`   Текст:  ${txtPath}`);
  console.log(`   JSON:   ${jsonPath}`);
} else {
  const text = await res.text();
  await writeFile(txtPath, text, "utf8");
  console.log(`✅ Готово за ${elapsed}s`);
  console.log(`   Текст: ${txtPath}`);
}
