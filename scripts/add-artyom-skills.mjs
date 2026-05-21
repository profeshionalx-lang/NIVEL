#!/usr/bin/env node
// Добавляет Артёму Орлову скилы Форхенд, Бэкхенд, Работа ног (+1 балл каждый).
//
// Запуск:
//   NEXT_PUBLIC_SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/add-artyom-skills.mjs
//
// Или с .env.local:
//   node --env-file=.env.local scripts/add-artyom-skills.mjs

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Нужны NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY");
  console.error("   node --env-file=.env.local scripts/add-artyom-skills.mjs");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "apikey": serviceRoleKey,
  "Authorization": `Bearer ${serviceRoleKey}`,
  "Prefer": "return=representation",
};

async function query(path, opts = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers, ...opts });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function rpc(fn, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${fn} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ─── 1. Найти Артёма Орлова ────────────────────────────────────────────────
console.log("🔍 Ищу профиль Артёма Орлова...");
const profiles = await query(`profiles?select=id,full_name,email&full_name=ilike.*орлов*`);

if (!profiles.length) {
  console.error("❌ Профиль с фамилией «Орлов» не найден в таблице profiles");
  process.exit(1);
}

const profile = profiles[0];
console.log(`✅ Найден: ${profile.full_name} (id: ${profile.id})`);

// ─── 2. Убедиться что скилы существуют ────────────────────────────────────
const SKILLS_TO_ADD = [
  { name: "Форхенд", name_ru: "Форхенд", name_en: "Forehand" },
  { name: "Бэкхенд", name_ru: "Бэкхенд", name_en: "Backhand" },
];

console.log("\n🔍 Проверяю скилы Форхенд и Бэкхенд...");

// Footwork (id=7, "Работа ног") уже должен существовать
const existingFootwork = await query(`skills?select=id,name,name_en&name_en=eq.Footwork`);
if (!existingFootwork.length) {
  console.error("❌ Скил Footwork (Работа ног) не найден в БД — проверь миграции");
  process.exit(1);
}
const footworkId = existingFootwork[0].id;
console.log(`✅ Footwork/Работа ног — id: ${footworkId}`);

const skillIds = [footworkId];

for (const skill of SKILLS_TO_ADD) {
  const existing = await query(`skills?select=id,name&name=eq.${encodeURIComponent(skill.name)}`);
  if (existing.length) {
    console.log(`✅ ${skill.name} уже есть — id: ${existing[0].id}`);
    skillIds.push(existing[0].id);
  } else {
    const created = await query(`skills`, {
      method: "POST",
      body: JSON.stringify(skill),
    });
    console.log(`✨ Создан скил ${skill.name} — id: ${created[0].id}`);
    skillIds.push(created[0].id);
  }
}

// ─── 3. Добавить +1 балл каждый скил ──────────────────────────────────────
console.log("\n🎯 Добавляю по 1 баллу...");

for (const skillId of skillIds) {
  await rpc("increment_skill_progress", {
    p_user_id: profile.id,
    p_skill_id: skillId,
  });

  const skillInfo = await query(`skills?select=name_ru,name_en&id=eq.${skillId}`);
  const name = skillInfo[0]?.name_ru || skillInfo[0]?.name_en || skillId;
  console.log(`  +1 балл → ${name}`);
}

console.log("\n✅ Готово! Артём Орлов получил по 1 баллу за Форхенд, Бэкхенд и Работа ног.");
