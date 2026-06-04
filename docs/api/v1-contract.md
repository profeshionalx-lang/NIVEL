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

## Write (A5)

Все успешные write-ответы — JSON-конверт `{ ok: true, ... }`; ошибки — по общему контракту выше
(401/403/400/404/422/500/502). `201` — для создания ресурса. Тела сверены по route-файлам
`src/app/api/v1/**` и их `*Core`-функциям.

### Ученики и приглашения
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /students` | `{ full_name }` | 201 `{ ok, studentId, claimUrl, claimToken, expiresAt }` |
| `PATCH /students/{id}` | `{ full_name?, avatar_url? }` | `{ ok }` (400 `Nothing to update`, если оба отсутствуют) |
| `POST /students/{id}/invite/regenerate` | — | `{ ok, studentId, claimUrl, claimToken, expiresAt }` |
| `POST /students/{id}/invite/revoke` | — | `{ ok }` |

### Цели
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /students/{id}/goals` | `{ customProblem? , problemId? }` | 201 `{ ok, goalId }` |
| `POST /goals/{id}/cancel` | — | `{ ok }` |

### Сессии
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /sessions` | `{ goalId, studentId, exercises: [{ name, skillNames: string[] }] }` | 201 `{ ok, sessionId }` |
| `POST /sessions/for-student` | `{ studentId, goalId, scheduledAt?, completedAt?, trainerNotes?, status?: "planned"\|"completed" }` | 201 `{ ok, sessionId }` |

`POST /sessions` резолвит/создаёт упражнения и навыки по имени (ilike) и инкрементит
`increment_skill_progress` (RPC) по уникальным навыкам — на клиенте прогресс трогать не нужно.

### Инсайт-карточки и ревью
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /sessions/{id}/insights/generate` | — | `{ ok, count }` (502 если анализ мутировал и упал, иначе 400) |
| `POST /sessions/{id}/insights/paste` | `{ markdown }` | `{ ok, count }` (400 `{ error, line }` при ошибке парсинга) |
| `PATCH /cards/{id}` | `{ title, body, tag, side? }` | `{ ok }` |
| `DELETE /cards/{id}` | — | `{ ok }` |
| `POST /cards/{id}/approve` | — | `{ ok }` |
| `POST /cards/{id}/reject` | — | `{ ok }` |
| `POST /sessions/{id}/cards/reorder` | `{ orderedIds: string[] }` | `{ ok }` |
| `POST /sessions/{id}/review-complete` | `{ completed?: boolean }` (деф. true) | `{ ok }` |

> См. «Канон нейминга карточек» выше: review-роуты карточек пока под `/cards/*`; чтение — под
> канонический `…/insight-cards`.

### Навыки ученика
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /students/{id}/skills` | `{ points, skillId? \| nameRu?, nameEn? }` | `{ ok }` |

### Библиотека шаблонов и коллекции
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /collections` | `{ name }` | 201 `{ ok, id }` |
| `POST /collections/{id}/cards` | `{ templateId }` | 201 `{ ok }` |
| `DELETE /collections/{id}/cards/{templateId}` | — | `{ ok }` |
| `POST /collections/{id}/apply` | `{ sessionId }` | `{ ok, applied }` |
| `POST /sessions/{id}/templates/apply` | `{ templateId }` | 201 `{ ok, id }` |

### Мастер-план
| Метод / путь | Вход | Успех |
|---|---|---|
| `POST /students/{id}/master-plan` | — | 201 `{ ok, id }` (создаёт пустой план; его `id` — это `planId` для секций ниже) |
| `POST /students/{id}/master-plan/sections` | `{ planId, title, category: strength\|technique\|tactics\|custom, sortOrder? }` | 201 `{ ok, id }` |
| `DELETE /students/{id}/master-plan/sections/{sectionId}` | — | `{ ok }` |
| `POST /students/{id}/master-plan/sections/{sectionId}/items` | `{ title, description?, imageUrl?, sortOrder? }` | 201 `{ ok, id }` |
| `DELETE /students/{id}/master-plan/items/{itemId}` | — | `{ ok }` |

> Чтение плана — `GET /students/{id}/master-plan` (A3); до создания плана возвращает `{ plan: null }`.

## Поддержание контракта (контракт-тесты)

`src/lib/core/__tests__/apiContract.test.ts` (`npm test`) фиксирует **форму ответов** read- и
audio-ядер (`trainerReads.ts`, `audio.ts`) — тех, чьи шейпы мапятся в DTO нативного клиента
(`nivel-android/.../data/remote/Dto.kt`). Тесты прогоняют ядра на mock-supabase и сверяют **точный
набор ключей** каждого объекта. Если поле переименовали/убрали/добавили — тест **падает**, пока не
обновишь и ядро, и ожидание в тесте, и этот документ (и DTO в `nivel-android`).

Write-ответы (A5) — простые конверты `{ ok, ... }`, документированы выше; их инвариант (`ok:true` +
перечисленные поля) дешевле держать ревью + типами роутов, чем мок-тестом каждого из ~21 роута.
