# Контракт REST API `/api/v1` (для нативного Android-клиента)

Статус: черновик A6 (часть «описание»). Эндпоинты определены в A2/A3/A4 (смёрджено/в ревью).
Раздел write (A5, PR #192) — дополнить после мёрджа. Контракт-тесты — отдельный шаг A6.

## Общее
- **Авторизация:** `Authorization: Bearer <jwt>` (тот же HMAC-JWT, что и web-кука `__session`).
  Получается через `POST /api/v1/auth/token`. `/api/v1/*` исключены из cookie-гейта `proxy.ts` и
  авторизуются сами (каждый хендлер зовёт `getSession()` + `requireTrainer*`).
- **Коды:** 401 — нет/невалидная сессия; 403 — не тренер/не владелец; 400 — тело запроса;
  404 — нет ресурса; 422 — `claim_*` ошибки; 502 — сбой внешнего шага (STT/анализ).
- **i18n:** где есть `name_ru`/`name_en` — поддерживается `?lang=ru|en` (дефолт ru).

## Auth (A2)
- `POST /api/v1/auth/token` — тело `{ idToken, claimToken? }` → `{ ok, token, user, expiresIn }`.
  `expiresIn` — секунды (TTL ~14 дней). `claimToken` → claim-флоу теневого ученика.

## Read (A3)
- `GET /api/v1/students` → `{ students: [{ id, email, full_name, avatar_url, active_goals, total_sessions }] }`
- `GET /api/v1/students/{id}` → `{ id, email, full_name, avatar_url, goals:[...], sessions:[...] }`
- `GET /api/v1/sessions/{id}` → `{ id, goal_id, session_number, status, trainer_notes, scheduled_at, completed_at, exercises:[{id,name,sort_order}] }`
- `GET /api/v1/sessions/{id}/insight-cards` → `{ cards: [{ id, title, body, quote, tags, front_text, context_text, source, trainer_status, student_decision, position, created_at }] }`
- `GET /api/v1/reference` → справочники problem_categories+problems, skills, exercises
- `GET /api/v1/students/{id}/master-plan` → секции + пункты мастер-плана

## Audio (A4)
- `POST /api/v1/sessions/{id}/audio/upload-url` — тело `{ ext? }` (деф. m4a) → `{ uploadUrl, storagePath }`
- `POST /api/v1/sessions/{id}/transcribe` — тело `{ storagePath }` → `{ ok }` (запускает Groq STT; `maxDuration=300`)
- `GET /api/v1/sessions/{id}/transcript/status` → `{ status, error_message, analysis_status, analysis_error }`

## ⚠️ Канон нейминга карточек (решение для реконсиляции)
Эндпоинт карточек сессии **канонически** — `GET /api/v1/sessions/{id}/insight-cards` (как в A3 #191;
соответствует таблице `insight_cards`).
- **A5 (#192):** привести review-роуты к префиксу `…/insight-cards/*` (а не `cards/*`).
- **B3-клиент (#36):** заменить ожидаемый путь `/sessions/{id}/cards` → `/sessions/{id}/insight-cards`.

## Осталось в A6 (после мёрджа A3+A5)
- Дописать раздел write-эндпоинтов (A5, 21 роут) с телами/ответами.
- Контракт-тесты, падающие при несовместимом изменении формы ответов.
