#!/usr/bin/env node
/**
 * Фоновый поллер: каждые 5 минут проверяет Supabase на наличие транскриптов
 * с analysis_status='idle', прогоняет каждый через Claude (claude -p),
 * парсит ответ (включая моменты "до"/"после") и сохраняет draft-карточки
 * через RPC replace_ai_draft_cards.
 *
 * Запуск: pm2 start scripts/analyze-pending.mjs --name nivel-analyzer
 * Логи:   pm2 logs nivel-analyzer
 *
 * SYSTEM_PROMPT и parseCards() дублируют src/lib/ai/insightsPrompt.ts и
 * src/lib/ai/parseInsights.ts (скрипт — чистый Node без сборки Next, TS
 * оттуда не импортировать). Дублирование уже расходилось один раз — теперь
 * закрыто guard-тестами в src/lib/ai/__tests__/analyzePendingParity.test.ts.
 * Меняешь промпт/парсер в src/lib/ai — переноси сюда посимвольно/логически.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

// ─── Конфиг ─────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 минут
const CLAUDE_TIMEOUT_MS = 25 * 60 * 1000; // 25 минут на один анализ (длинные транскрипты)

// Изоляция консольного Claude от контекста проекта: запускаем из нейтральной
// директории (не грузим CLAUDE.md / .claude / хуки) и с --strict-mcp-config
// (без MCP-серверов). Иначе на каждый запуск подтягиваются SessionStart-хуки
// (pm2, gh, Vercel) и MCP — это замедляет старт и приводило к зависаниям на
// длинных транскриптах. OAuth-вход по подписке при этом сохраняется.
const CLAUDE_CWD = tmpdir();

// Идентичен src/lib/ai/insightsPrompt.ts::INSIGHTS_PROMPT — менять синхронно!
// (проверяется посимвольно в analyzePendingParity.test.ts)
export const SYSTEM_PROMPT = `Ты помогаешь тренеру по паделю. Прочитай транскрипт тренировки, который приведён в следующем сообщении, и выдели практические инсайты для ученика.

Транскрипт размечен таймкодами по сегментам в формате [начало–конец] текст, секунды от начала записи (например [412.5–418.2] текст). Используй эти числа для полей "Момент до" и "Момент после" — копируй секунду начала нужного сегмента как есть, не пересчитывай и не переводи в минуты.

ВЫВЕДИ РЕЗУЛЬТАТ СТРОГО В ЭТОМ ФОРМАТЕ (никаких таблиц, нумерации, bold-выделений):

## Карточка 1
- Тема: техника
- Заголовок: <короткий совет, до 80 знаков>
- Описание: <конкретное действие, до 400 знаков>
- Цитата: "<дословная фраза из транскрипта>"
- Момент до: <секунда начала сегмента, где тренер указывает на ошибку>
- Момент после: <секунда начала сегмента, где то же самое исполнено правильно>

## Карточка 2
- Тема: тактика
- Заголовок: ...
- Описание: ...
- Цитата: "..."
- Момент до: ...
- Момент после: ...

ПРАВИЛА:
- Тема обязательно одна из: техника, тактика, физика, менталка (строчные буквы)
- Минимум 5, максимум 15 карточек
- В каждой карточке цитата — дословная фраза из транскрипта (без неё инсайт невалиден)
- Только actionable советы, не пересказ
- Никакого markdown-форматирования внутри полей (**bold**, *italic* и т.п.)
- Никаких таблиц, нумерованных списков, заголовков # или ###
- «Момент до» и «Момент после» опциональны: если в транскрипте нет подходящего сегмента с ошибкой и/или её исправлением — просто не пиши это поле в карточке (не пиши "нет", "—", "null" и т.п.)`;

// ─── Supabase config (ленивая загрузка — не читать .env.local при импорте модуля) ──

let SUPA_URL;
let SERVICE;
let headers;

function loadConfig() {
  const ENV_PATH = new URL("../.env.local", import.meta.url).pathname;
  const env = readFileSync(ENV_PATH, "utf8");
  SUPA_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n]+)"?/)[1];
  SERVICE = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n]+)"?/)[1];
  headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

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
  const json = await r.json();
  // PostgREST error bodies are `{code, details, hint, message}` — there is no
  // `.error` key. Callers used to (incorrectly) check `result?.error`, which
  // never matches a real failure and let errors fall through as if the RPC
  // had succeeded. Normalize here so every caller can check `.error`.
  if (!r.ok) {
    return { error: json?.message ?? `RPC ${fn} вернул ${r.status}`, ...json };
  }
  return json;
}

// ─── Timecoded transcript (порт src/lib/ai/timecodedTranscript.ts) ───────────

const MAX_TRANSCRIPT_CHARS = 24_000;
const MIN_SEGMENT_TEXT_CHARS = 20;

function formatSeconds(n) {
  return n.toFixed(1);
}

function formatLine(segment) {
  return `[${formatSeconds(segment.start)}–${formatSeconds(segment.end)}] ${segment.text}`;
}

export function buildTimecodedTranscript(segments) {
  if (segments.length === 0) return "";

  let working = segments.map((s) => ({ ...s }));
  let text = working.map(formatLine).join("\n");

  while (text.length > MAX_TRANSCRIPT_CHARS) {
    let idx = -1;
    let maxLen = MIN_SEGMENT_TEXT_CHARS;
    for (let i = 0; i < working.length; i++) {
      if (working[i].text.length > maxLen) {
        maxLen = working[i].text.length;
        idx = i;
      }
    }
    if (idx === -1) break;

    const seg = working[idx];
    const targetLen = Math.max(MIN_SEGMENT_TEXT_CHARS, Math.floor(seg.text.length * 0.8));
    working[idx] = { ...seg, text: seg.text.slice(0, targetLen).trimEnd() + "…" };
    text = working.map(formatLine).join("\n");
  }

  return text;
}

// ─── Нормализация моментов (порт src/lib/ai/moments.ts) ──────────────────────

const QUOTE_DRIFT_TOLERANCE_SECONDS = 15;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeForMatch(s) {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalizeForMatch(s).split(" ").filter(Boolean);
}

function findQuoteSegment(quote, segments) {
  const normalizedQuote = normalizeForMatch(quote);
  if (!normalizedQuote || segments.length === 0) return null;

  for (const seg of segments) {
    if (normalizeForMatch(seg.text).includes(normalizedQuote)) {
      return seg;
    }
  }

  const quoteTokens = new Set(tokenize(quote));
  if (quoteTokens.size === 0) return null;

  let best = null;
  let bestScore = 0;

  for (const seg of segments) {
    const segTokens = tokenize(seg.text);
    if (segTokens.length === 0) continue;
    const overlap = segTokens.filter((t) => quoteTokens.has(t)).length;
    const score = overlap / quoteTokens.size;
    if (score > bestScore) {
      bestScore = score;
      best = seg;
    }
  }

  return bestScore > 0 ? best : null;
}

export function normalizeMoments({ momentBefore, momentAfter, quote, segments, durationSeconds }) {
  let before = momentBefore;
  let after = momentAfter;

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

// ─── Парсер карточек (порт src/lib/ai/parseInsights.ts) ──────────────────────

const VALID_TAGS = new Set(["техника", "тактика", "физика", "менталка"]);

const FIELD_KEYS = ["тема", "заголовок", "описание", "цитата", "момент до", "момент после"];

const FIELD_LINE = new RegExp(`^\\s*[-–—*•]?\\s*(${FIELD_KEYS.join("|")})\\s*:(.*)$`, "i");

// Строка похожа на поле списка (`- Ключ: значение`), но ключ не входит в
// FIELD_KEYS — сбрасываем current, не приклеиваем к предыдущему полю.
const UNKNOWN_FIELD_LINE = /^\s*[-–—*•]\s*[^:\n]{1,40}:\s/;

function stripQuotes(s) {
  return s.replace(/^["'«“‘«]+|["'»”’»]+$/g, "").trim();
}

export function parseMoment(raw) {
  const s = raw.trim();
  if (!s) return null;

  const mmss = s.match(/^[^\d]*(\d+):(\d{1,2}(?:\.\d+)?)[^\d]*$/);
  if (mmss) {
    const minutes = Number(mmss[1]);
    const seconds = Number(mmss[2]);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds;
    }
    return null;
  }

  const bare = s.match(/^[^\d-]*(\d+(?:\.\d+)?)[^\d]*$/);
  if (bare) {
    const value = Number(bare[1]);
    return Number.isFinite(value) ? value : null;
  }

  return null;
}

function parseBlock(lines) {
  const acc = {
    тема: [],
    заголовок: [],
    описание: [],
    цитата: [],
    "момент до": [],
    "момент после": [],
  };
  const seen = new Set();
  let current = null;

  for (const line of lines) {
    const m = line.match(FIELD_LINE);
    if (m) {
      const key = m[1].toLowerCase();
      current = key;
      seen.add(key);
      acc[key].push(m[2].trim());
    } else if (UNKNOWN_FIELD_LINE.test(line)) {
      current = null;
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed) acc[current].push(trimmed);
    }
  }

  const out = {};
  for (const key of FIELD_KEYS) {
    if (seen.has(key)) out[key] = acc[key].join(" ").replace(/\s+/g, " ").trim();
  }
  return out;
}

/**
 * Разбирает markdown-ответ модели на карточки. Возвращает { ok: true, cards }
 * либо { ok: false, error, line } — 1:1 с parseInsightsMarkdown в src/lib/ai
 * (см. guard-тест parity), в т.ч. по тому, что одна невалидная карточка
 * роняет разбор целиком, а не просто пропускается.
 */
export function parseCardsMarkdown(input) {
  const lines = input.split(/\r?\n/);
  const blocks = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    if (/^\s*##\s+/.test(lines[i])) {
      if (current) {
        blocks.push({ startLine: current.startLine, fields: parseBlock(current.lines) });
      }
      current = { startLine: i + 1, lines: [] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) {
    blocks.push({ startLine: current.startLine, fields: parseBlock(current.lines) });
  }

  if (blocks.length === 0) {
    return { ok: false, error: "Не найдено ни одной карточки" };
  }

  const cards = [];

  for (let idx = 0; idx < blocks.length; idx++) {
    const { fields, startLine } = blocks[idx];
    const cardNum = idx + 1;

    if (!fields.тема) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Тема»`, line: startLine };
    }
    if (!fields.заголовок) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Заголовок»`, line: startLine };
    }
    if (!fields.описание) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Описание»`, line: startLine };
    }
    if (fields.цитата === undefined) {
      return { ok: false, error: `Карточка ${cardNum}: отсутствует поле «Цитата»`, line: startLine };
    }

    const tag = fields.тема.toLowerCase();
    if (!VALID_TAGS.has(tag)) {
      return {
        ok: false,
        error: `Карточка ${cardNum}: неизвестная тема «${fields.тема}». Допустимые: техника, тактика, физика, менталка`,
        line: startLine,
      };
    }

    cards.push({
      title: fields.заголовок,
      body: fields.описание,
      tag,
      quote: stripQuotes(fields.цитата),
      momentBeforeSeconds: fields["момент до"] !== undefined ? parseMoment(fields["момент до"]) : null,
      momentAfterSeconds: fields["момент после"] !== undefined ? parseMoment(fields["момент после"]) : null,
    });
  }

  return { ok: true, cards };
}

/** Совместимость с прежним вызовом: массив карточек, либо [] на невалидный markdown. */
export function parseCards(md) {
  const result = parseCardsMarkdown(md);
  return result.ok ? result.cards : [];
}

// ─── Основная логика ─────────────────────────────────────────────────────────

async function getPendingSessions() {
  return supaGet(
    "transcripts?status=eq.ready&analysis_status=eq.idle&raw_text=not.is.null&select=session_id,raw_text,segments_json,duration_seconds"
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

async function analyzeSession(session) {
  const { session_id: sessionId, raw_text: rawText, duration_seconds: durationSeconds } = session;
  const segments = Array.isArray(session.segments_json) ? session.segments_json : [];

  log(`[${sessionId.slice(0,8)}] Начинаю анализ (${rawText.length} символов)`);

  // Помечаем как "в процессе"
  await supaPatch("transcripts", { session_id: sessionId }, { analysis_status: "processing", analysis_error: null });

  const transcriptText = segments.length > 0 ? buildTimecodedTranscript(segments) : rawText;

  // Вызов Claude через CLI
  const prompt = `${SYSTEM_PROMPT}\n\nТранскрипт тренировки:\n${transcriptText}`;
  const t0 = Date.now();
  const result = spawnSync("claude", ["-p", prompt, "--output-format", "text", "--strict-mcp-config"], {
    encoding: "utf8",
    timeout: CLAUDE_TIMEOUT_MS,
    maxBuffer: 10 * 1024 * 1024,
    cwd: CLAUDE_CWD,
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
  const parsed = parseCardsMarkdown(markdown);

  if (!parsed.ok) {
    const errMsg = `LLM вернул невалидный формат: ${parsed.error}`;
    log(`[${sessionId.slice(0,8)}] ОШИБКА: ${errMsg}`);
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: errMsg.slice(0, 500),
    });
    return;
  }

  const cards = parsed.cards.map((card) => {
    const normalized = normalizeMoments({
      momentBefore: card.momentBeforeSeconds,
      momentAfter: card.momentAfterSeconds,
      quote: card.quote,
      segments,
      durationSeconds: durationSeconds ?? null,
    });
    return { ...card, ...normalized };
  });

  // Получаем student_id и trainer_id сессии
  const meta = await getSessionMeta(sessionId);
  if (!meta) {
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: "Сессия не найдена в БД",
    });
    return;
  }

  // Сохраняем через RPC v2 (replace_ai_draft_cards, #249): принимает
  // moment_before/moment_after и возвращает { inserted, orphan_paths }.
  const rpcResult = await supaRpc("replace_ai_draft_cards", {
    p_session_id:  sessionId,
    p_student_id:  meta.student_id,
    p_trainer_id:  meta.trainer_id,
    p_cards: cards.map(c => ({
      title: c.title,
      body: c.body,
      quote: c.quote,
      tag: c.tag,
      moment_before: c.momentBeforeSeconds ?? null,
      moment_after: c.momentAfterSeconds ?? null,
    })),
  });

  if (rpcResult?.error) {
    log(`[${sessionId.slice(0,8)}] ОШИБКА RPC: ${JSON.stringify(rpcResult.error)}`);
    await supaPatch("transcripts", { session_id: sessionId }, {
      analysis_status: "failed",
      analysis_error: String(rpcResult.error).slice(0, 500),
    });
    return;
  }

  // v2 RPC возвращает jsonb `{ inserted, orphan_paths }` вместо голого
  // счётчика: переанализ мог снести драфты, к которым тренер уже приложил
  // кадры — каскада БД→Storage нет, поэтому чистим Storage сами. Ошибка
  // удаления не должна ронять уже успешный анализ — логируем и продолжаем.
  const insertedCount = rpcResult?.inserted ?? cards.length;
  const orphanPaths = rpcResult?.orphan_paths ?? [];

  if (orphanPaths.length > 0) {
    // Storage API shape (matches @supabase/storage-js `remove()`):
    // DELETE /storage/v1/object/{bucket} with body {prefixes: [...]}.
    // There is no POST /object/remove/{bucket} route.
    const r = await fetch(`${SUPA_URL}/storage/v1/object/session-frames`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ prefixes: orphanPaths }),
    });
    if (!r.ok) {
      log(`[${sessionId.slice(0,8)}] Не удалось удалить осиротевшие кадры (${r.status}): ${await r.text()}`);
    }
  }

  await supaPatch("transcripts", { session_id: sessionId }, {
    analysis_status: "ready",
    analysis_error: null,
  });

  log(`[${sessionId.slice(0,8)}] Готово: ${insertedCount} карточек за ${elapsed}s`);
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
    await analyzeSession(s);
  }
}

async function main() {
  loadConfig();
  log("Nivel analyzer запущен. Проверка каждые 5 минут.");
  log(`Claude: ${spawnSync("claude", ["--version"], { encoding: "utf8" }).stdout?.trim()}`);

  // Сразу проверяем при старте, потом каждые 5 минут
  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

// Запускаем демон только при прямом вызове (`node scripts/analyze-pending.mjs`),
// не при импорте модуля (напр. из guard-тестов analyzePendingParity.test.ts) —
// иначе тест уронит сеть/бесконечный setInterval внутри vitest.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
