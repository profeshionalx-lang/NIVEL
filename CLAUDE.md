@AGENTS.md

# Nivel — Padel Coaching Platform

## Что за проект

Nivel — приложение для тренеров по паделю и их учеников. Тренер ведёт сессии, записывает insight-карточки (разборы ошибок), ставит цели. Ученик видит свой прогресс и карточки.

Аутентификация — через Гречка (https://www.grecha.one) — внешняя падел-платформа с базой игроков. OAuth-like flow: Nivel → grecha.one/auth-nivel.html → Firebase ID token → HMAC-подписанная сессионная кука.

## Стек

| Слой | Технология |
|------|-----------|
| Framework | Next.js 16.2.2 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Auth | Firebase Auth (project: grechka-6bdb7) + jose для верификации JWT |
| База данных | Supabase (Postgres) — project: gqcyaxxhvyvpzuhoysis |
| Деплой | Vercel |
| Сессии | HMAC JWT в httpOnly cookie `__session` (14 дней, SESSION_SECRET) |

## Архитектура

```
src/
  app/
    api/
      auth/
        grechka/          — инициирует OAuth: ставит state-cookie, редиректит на grecha.one
        grechka-callback/ — принимает token+state, вызывает createSession(), редиректит на /dashboard
        session/          — POST: Google Sign-In fallback (напрямую Firebase token → сессия)
        logout/           — DELETE __session cookie
    dashboard/            — главный экран тренера/ученика
    goals/                — цели тренировок
    sessions/             — история тренировочных сессий
    insights/             — карточки разбора ошибок
    trainer/              — управление учениками (только role=trainer)
    login/                — страница входа
  lib/
    auth/session.ts       — createSession / getSession / deleteSession (НЕ "use server")
    firebase/
      client.ts           — lazy getFirebaseAuth() для клиента
      admin.ts            — verifyFirebaseIdToken() через JWKS (без firebase-admin)
    supabase/server.ts    — createClient() с SERVICE_ROLE_KEY (bypasses RLS)
    actions/              — Server Actions (формы, мутации)
  proxy.ts                — auth gate: проверяет __session, редиректит неавторизованных
```

## Ключевые решения

- **Нет firebase-admin**: верификация токенов через Google JWKS (`jose` + `createRemoteJWKSet`) — не нужен service account
- **Supabase без RLS**: используем service role key, авторизация на уровне приложения через сессию
- **profiles.id**: обычный `gen_random_uuid()`, НЕ FK на auth.users (мы не используем Supabase Auth)
- **session.ts без "use server"**: файл — обычный модуль, вызывается из Route Handlers и Server Actions
- **proxy.ts, не middleware.ts**: Next.js 16 использует `proxy.ts` как точку входа для middleware-логики

## ENV переменные

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=grechka-6bdb7
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_NIVEL_URL          — http://localhost:3000 (dev) / https://nivel-five.vercel.app (prod)
NEXT_PUBLIC_GRECHKA_URL        — https://www.grecha.one
SESSION_SECRET                 — 64-char hex, для подписи HMAC JWT
SUPABASE_SERVICE_ROLE_KEY      — server-only, bypasses RLS
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL
```

---

## Git-правила

**Никогда не пушить напрямую в `main`.** Только через feature-ветки и PR.

```bash
# Правильный workflow:
git checkout -b feat/my-feature   # или fix/, chore/, refactor/
# ... работа ...
git push -u origin feat/my-feature
gh pr create --title "..." --body "..."
# После апрува — merge через GitHub UI
```

Называй ветки так: `feat/<что>`, `fix/<что>`, `chore/<что>`.

Один PR — одна логическая задача. Не смешивай фичи и рефакторинг.

---

## Работа с GitHub Issues

### Взять задачу

1. Найди открытый issue с лейблом `ready-for-agent` (или `in-progress` если уже назначен)
2. Переведи его в `in-progress`, убери `ready-for-agent`
3. Создай ветку: `feat/<issue-number>-<slug>`

```bash
gh issue edit <number> --add-label "in-progress" --remove-label "ready-for-agent"
git checkout -b feat/<number>-<slug>
```

### Завершить задачу

1. Создай PR, в теле упомяни `Closes #<number>`
2. Переведи issue в `in_review`, убери `in-progress`
3. Оставь комментарий с результатом (что сделано, PR ссылка, что проверить)

```bash
gh pr create --title "feat: ..." --body "Closes #<number>\n\n..."
gh issue edit <number> --add-label "in_review" --remove-label "in-progress"
gh issue comment <number> --body "✅ Готово. PR: <url>\n\nЧто сделано:\n- ...\n\nЧто проверить:\n- ..."
```

### Заблокирован?

Если задача требует решения человека (доступы, неясные требования, конфликт с архитектурой):

```bash
gh issue edit <number> --add-label "blocked" --remove-label "in-progress"
gh issue comment <number> --body "🚫 Заблокировано: <причина>\n\nЧто нужно: <что именно>"
```

---

## Перед началом работы

1. Проверь открытые `in-progress` issues — они уже показаны в SessionStart hook
2. Прочитай `node_modules/next/dist/docs/` если работаешь с незнакомым API Next.js 16
3. После изменений в схеме Supabase — применяй через Management API (MCP read-only):

```bash
curl -s -X POST \
  "https://api.supabase.com/v1/projects/gqcyaxxhvyvpzuhoysis/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "..."}'
```
