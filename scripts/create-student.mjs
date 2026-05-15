#!/usr/bin/env node
/**
 * Быстрое создание ученика со стартовой целью и первой тренировкой.
 *
 * Использование:
 *   node scripts/create-student.mjs \
 *     --name "Ivan Ivanov" \
 *     --goal "Backhand from defense" \
 *     --session-notes "Тактика" \
 *     --session-date "2026-05-14T14:00"   # локальное время Мск (UTC+3)
 *
 * Флаги:
 *   --name           Имя ученика (обязательно)
 *   --goal           Цель (custom_problem). Если не указано — цель не создаётся.
 *   --session-notes  Заметки тренера / название тренировки. Требует --goal.
 *   --session-date   Дата и время тренировки в формате "YYYY-MM-DDTHH:mm" (локаль Мск UTC+3).
 *                    По умолчанию — сейчас. Требует --goal.
 *   --session-count  Плановое кол-во сессий в цели (по умолчанию 8)
 *
 * ENV:
 *   SUPABASE_PROJECT  project ref (default: gqcyaxxhvyvpzuhoysis)
 *   SUPABASE_TOKEN    Management API token (sbp_...)
 *   TRAINER_ID        UUID тренера (default: 679b41f8-da19-4cb5-8b03-76be6237232f)
 *   NIVEL_URL         base URL (default: https://nivel-five.vercel.app)
 */

import { parseArgs } from "node:util";

const PROJECT   = process.env.SUPABASE_PROJECT ?? "gqcyaxxhvyvpzuhoysis";
const TOKEN     = process.env.SUPABASE_TOKEN;
const TRAINER   = process.env.TRAINER_ID       ?? "679b41f8-da19-4cb5-8b03-76be6237232f";
const BASE_URL  = process.env.NIVEL_URL        ?? "https://nivel-five.vercel.app";

if (!TOKEN) {
  console.error("❌  Укажи SUPABASE_TOKEN=sbp_... в окружении");
  console.error("    Пример: SUPABASE_TOKEN=sbp_... node scripts/create-student.mjs ...");
  process.exit(1);
}
const API_URL   = `https://api.supabase.com/v1/projects/${PROJECT}/database/query`;

async function sql(query) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(JSON.stringify(body.error ?? body));
  return body; // array of rows
}

// Convert "YYYY-MM-DDTHH:mm" local Moscow (UTC+3) → UTC ISO string
function moscowToUtc(localStr) {
  const [datePart, timePart] = localStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = (timePart ?? "00:00").split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour - 3, minute); // UTC+3 → UTC
  return new Date(utcMs).toISOString();
}

const { values } = parseArgs({
  options: {
    name:           { type: "string" },
    goal:           { type: "string" },
    "session-notes":{ type: "string" },
    "session-date": { type: "string" },
    "session-count":{ type: "string" },
  },
  strict: false,
});

const name         = values["name"];
const goalText     = values["goal"];
const sessionNotes = values["session-notes"];
const sessionDate  = values["session-date"];
const sessionCount = parseInt(values["session-count"] ?? "8", 10);

if (!name) {
  console.error("❌  --name обязателен");
  process.exit(1);
}

// ── 1. Создать профиль ───────────────────────────────────────────────────────
console.log(`\n🧑 Создаю ученика: ${name}`);
const [profile] = await sql(`
  INSERT INTO profiles (full_name, role, created_by, claim_token, claim_expires_at)
  VALUES (
    '${name.replace(/'/g, "''")}',
    'student',
    '${TRAINER}',
    encode(gen_random_bytes(32), 'hex'),
    now() + interval '30 days'
  )
  RETURNING id, claim_token;
`);
const studentId  = profile.id;
const claimToken = profile.claim_token;
const inviteUrl  = `${BASE_URL}/invite/${claimToken}`;

console.log(`   ✅ ID: ${studentId}`);
console.log(`   🔗 Invite: ${inviteUrl}`);

// ── 2. Цель ─────────────────────────────────────────────────────────────────
if (!goalText) {
  console.log("\n⚠️  --goal не указан, цель и тренировка не создаются.");
  printSummary();
  process.exit(0);
}

console.log(`\n🎯 Создаю цель: "${goalText}"`);
const [goal] = await sql(`
  INSERT INTO goals (user_id, custom_problem, status, session_count)
  VALUES ('${studentId}', '${goalText.replace(/'/g, "''")}', 'active', ${sessionCount})
  RETURNING id;
`);
const goalId = goal.id;
console.log(`   ✅ goal_id: ${goalId}`);

// ── 3. Тренировка ────────────────────────────────────────────────────────────
if (!sessionNotes && !sessionDate) {
  console.log("\n⚠️  --session-notes и --session-date не указаны, тренировка не создаётся.");
  printSummary();
  process.exit(0);
}

const scheduledUtc = sessionDate
  ? moscowToUtc(sessionDate)
  : new Date().toISOString();

const notes = (sessionNotes ?? "").replace(/'/g, "''");
console.log(`\n📅 Создаю тренировку: "${sessionNotes ?? ""}" @ ${scheduledUtc} UTC`);
await sql(`
  INSERT INTO sessions (goal_id, session_number, trainer_notes, status, scheduled_at, completed_at)
  VALUES ('${goalId}', 1, '${notes}', 'completed', '${scheduledUtc}', '${scheduledUtc}');
`);
console.log(`   ✅ Тренировка создана`);

printSummary();

function printSummary() {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${name}
  ID:     ${studentId}
  Invite: ${inviteUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}
