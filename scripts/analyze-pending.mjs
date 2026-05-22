#!/usr/bin/env node
/**
 * Фоновый поллер: каждые 5 минут проверяет Supabase на наличие транскриптов
 * с analysis_status='idle', прогоняет каждый через Claude (claude -p),
 * парсит ответ и сохраняет draft-карточки через RPC replace_ai_draft_cards.
 *
 * Запуск: pm2 start scripts/analyze-pending.mjs --name nivel-analyzer
 * Логи:   pm2 logs nivel-analyzer
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ─── Конфиг ─────────────────────────────────────────────────────────────────

const ENV_PATH = new URL("../.env.local", import.meta.url).pathname;
const env = readFileSync(ENV_PATH, "utf8");
const SUPA_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?/)[1];
const SERVICE  = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 минут
const CLAUDE_TIMEOUT_MS = 5 * 60 * 1000; // 5 минут на один анализ

// Тот же промпт что в src/lib/ai/insightsPrompt.ts — менять синхронно!
const SYSTEM_PROMPT = `Ты помогаешь тренеру по паделю. Прочитай транскрипт тренировки, который приведён в следующем сообщении, и выдели практические инсайты для ученика.

ВЫВЕДИ РЕЗУЛЬТАТ СТРОГО В ЭТОМ ФОРМАТЕ (никаких таблиц, нумерации, bold-выделений):

## Карточка 1
- Тема: техника
- Заголовок: <короткий совет, до 80 знаков>
- Описание: <конкретное действие, до 400 знаков>
- Цитата: "<дословная фраза из транскрипта>"

## Карточка 2
- Тема: тактика
- Заголовок: ...
- Описание: ...
- Цитата: "..."

ПРАВИЛА:
- Тема обязательно одна из: техника, тактика, физика, менталка (строчные буквы)
- Минимум 5, максимум 15 карточек
- В каждой карточке цитата — дословная фраза из транскрипта (без неё инсайт невалиден)
- Только actionable советы, не пересказ
- Никакого markdown-форматирования внутри полей (**bold**, *italic* и т.п.)
- Никаких таблиц, нумерованных списков, заголовков # или ###`;

// ─── Supabase helpers ────────────────────────────────────────────────────────

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

async function supaGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { headers });
  return r.json();
}

async function supaPost(path, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  return r.json();
}

async function supaPatch(table, match, body) {
  const params = Object.entries(match).map(([k, v]) => `${k}=eq.${v}`).join("&");
  await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { method: "PATCH", headers, body: JSON.stringify(body) });
}

async function supaRpc(fn, body) {
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(body) });
  return r.json();
}

// ─── Парсер карточек ─────────────────────────────────────────────────────────

function parseCards(md) {
  const blocks = md.split(/^##\s+Карточка\s+\d+/m).slice(1);
  const cards = [];
  for (const block of blocks) {
    const tag   = block.match(/[-–]\s*Тема:\s*(.+)/)?.[1]?.trim().toLowerCase();
    const title = block.match(/[-–]\s*Заголовок:\s*(.+)/)?.[1]?.trim();
    const body  = block.match(/[-–]\s*Описание:\s*(.+)/)?.[1]?.trim();
    const quote = block.match(/[-–]\s*Цитата:\s*"?([^"\n]+)"?/)?.[1]?.trim();

    if (!title || !body) continue;

    const validTags = new Set(["техника", "тактика", "физика", "менталка"]);
    cards.push({ title, body, quote: quote ?? "", tag: validTags.has(tag) ? tag : "техника" });
  }
  return cards;
}

// ─── Основная логика ─────────────────────────────────────────────────────────

async function getPendingSessions() {
  return supaGet(
    "transcripts?status=eq.ready&analysis_status=eq.idle&raw_text=not.is.null&select=session_id,raw_text"
  );
}

async function getSessionMeta(sessionId) {
  // student_id: sessions → goals.user_id
  // trainer_id: profiles.created_by (кто создал студента)
  const rows = await supaGet(
    `sessions?id=eq.${sessionId}&select=id,goals!inner(user_id,profiles!inner(created_by))`
  );
  const row = rows?.[0];
  if (!row) return null;
  const studentId = row.goals?.user_id;
  const trainerId = row.goals?.profiles?.created_by;
  if (!studentId || !trainerId) return null;
  return { student_id: studentId, trainer_id: trainerId };
}

async function analyzeSession(sessionId, rawText) {
  log(`[${sessionId.slice(0,8)}] Начинаю анализ (${rawText.length} символов)`);

  // Помечаем как "в процессе"
  await supaPatch("transcripts", { session_id: sessionId }, { analysis_status: "processing", analysis_error: null });

  // Вызов Claude через CLI
  const prompt = `${SYSTEM_PROMPT}\n\nТранскрипт тренировки:\n${rawText}`;
  const t0 = Date.now();
  const result = spawnSync("claude", ["-p", prompt, "--output-format", "text"], {
    encoding: "utf8",
    timeout: CLAUDE_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (result.error || result.status !== 0) {
    const errMsg = result.error?.message ?? result.stderr ?? "claude вернул ненулевой код";
    log(`[${sessionId.slice(0,8)}] ОШИБКА (${elapsed}s): ${errMsg}`);
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: errMsg.slice(0, 500),
    });
    return;
  }

  const markdown = result.stdout?.trim() ?? "";
  const cards = parseCards(markdown);

  if (cards.length < 1) {
    const errMsg = `Claude вернул 0 карточек. Ответ: ${markdown.slice(0, 200)}`;
    log(`[${sessionId.slice(0,8)}] ОШИБКА: ${errMsg}`);
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: errMsg.slice(0, 500),
    });
    return;
  }

  // Получаем student_id и trainer_id сессии
  const meta = await getSessionMeta(sessionId);
  if (!meta) {
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: "Сессия не найдена в БД",
    });
    return;
  }

  // Сохраняем через RPC
  const rpcResult = await supaRpc("replace_ai_draft_cards", {
    p_session_id:  sessionId,
    p_student_id:  meta.student_id,
    p_trainer_id:  meta.trainer_id,
    p_cards: cards.map(c => ({ title: c.title, body: c.body, quote: c.quote, tag: c.tag })),
  });

  if (rpcResult?.error) {
    log(`[${sessionId.slice(0,8)}] ОШИБКА RPC: ${JSON.stringify(rpcResult.error)}`);
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: String(rpcResult.error).slice(0, 500),
    });
    return;
  }

  await supaPatch("transcripts", { session_id: sessionId }, {
    analysis_status: "ready",
    analysis_error: null,
  });

  log(`[${sessionId.slice(0,8)}] Готово: ${cards.length} карточек за ${elapsed}s`);
}

// ─── Цикл ────────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`${new Date().toISOString().slice(0,19).replace("T"," ")} ${msg}`);
}

async function tick() {
  const sessions = await getPendingSessions();
  if (!sessions?.length) return;

  log(`Найдено ${sessions.length} сессий для анализа`);
  for (const s of sessions) {
    await analyzeSession(s.session_id, s.raw_text);
  }
}

log("Nivel analyzer запущен. Проверка каждые 5 минут.");
log(`Claude: ${spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout?.trim()}`);

// Сразу проверяем при старте, потом каждые 5 минут
await tick();
setInterval(tick, POLL_INTERVAL_MS);
