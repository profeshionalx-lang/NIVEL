# Playtomic Matches — Design

> **Статус:** дизайн после брейншторминга. Детальные планы под каждую задачу пишутся отдельно (skill `writing-plans`).

**Goal:** Ученик подключает свой Playtomic-профиль один раз, после чего его предстоящие матчи автоматически появляются в Nivel. На каждый предстоящий матч ученик может прикрепить инсайты из своей коллекции — это «цели на игру». После игры из Playtomic подтягивается счёт, ученик пишет короткую рефлексию. Тренер всё это видит в режиме чтения.

**Architecture:**
- Используем публичный неавторизованный API Playtomic: `GET https://api.playtomic.io/v1/matches/{id}` для одиночного матча и `GET https://api.playtomic.io/v1/matches?user_id={uid}&size=200` для списка матчей игрока.
- Идентификатор Playtomic-пользователя сохраняем в `profiles`. На синке тянем матчи, фильтруем по `start_date` и статусу, апсёртим в `matches` по паре `(profile_id, playtomic_match_id)`.
- Связь «инсайт ↔ матч» — junction-таблица `match_goals`. Никаких отдельных «целей на игру» как сущности.
- Синхронизация — ленивая: на каждом открытии страниц `/matches` / `/dashboard`, с кэшем 10 минут (поле `playtomic_synced_at` на профиле). Vercel Cron в MVP не используем.
- Существующая таблица `goals` (тренировочные цели) не затрагивается.

**Tech Stack:** Next.js 16 App Router, Supabase (service role key), Server Actions, Tailwind v4. Никаких новых зависимостей.

---

## Data Model

**Расширение `profiles`:**
- `playtomic_user_id text` — например `"5536921"`. Null если не подключён.
- `playtomic_synced_at timestamptz` — время последнего успешного синка.

**Новая таблица `matches`:**
- `id uuid pk`
- `profile_id uuid not null references profiles(id) on delete cascade`
- `playtomic_match_id text not null`
- `start_date timestamptz not null`
- `end_date timestamptz`
- `location text` — название клуба
- `resource_name text` — корт
- `status text` — `PENDING` / `CONFIRMED` / `CANCELED` / `PLAYED` (последний выставляем сами, когда `end_date < now()` и есть `results`)
- `teams jsonb` — сырой массив `teams` из Playtomic-ответа
- `results jsonb` — сырой `results`, null до завершения матча
- `reflection text` — пишет ученик после игры
- `last_synced_at timestamptz default now()`
- `unique(profile_id, playtomic_match_id)`

**Новая таблица `match_goals`:**
- `match_id uuid references matches(id) on delete cascade`
- `insight_id uuid references insight_cards(id) on delete cascade`  <!-- фактическое имя таблицы инсайтов в БД — `insight_cards` -->`
- `created_at timestamptz default now()`
- `primary key (match_id, insight_id)`

---

## Playtomic Integration Layer

Новый модуль `src/lib/playtomic/client.ts`:
- `parseProfileUrl(url: string): string | null` — вытаскивает `user_id` из URL вида `https://app.playtomic.io/profile/users/5536921`.
- `parseMatchUrl(url: string): string | null` — вытаскивает `match_id` из `https://app.playtomic.io/matches/{uuid}`.
- `fetchMatch(matchId: string): Promise<PlaytomicMatch>` — `GET /v1/matches/{id}`.
- `fetchUserMatches(userId: string): Promise<PlaytomicMatch[]>` — `GET /v1/matches?user_id={uid}&size=200`.
- Типы `PlaytomicMatch` — минимально необходимое подмножество полей (`match_id`, `start_date`, `end_date`, `location`, `resource_name`, `status`, `teams`, `results`).

Все запросы без авторизации. `User-Agent: Mozilla/5.0` достаточно. Таймаут 5 секунд, при ошибке возвращаем `null`/`[]` и не падаем.

---

## Sync Logic

Новый модуль `src/lib/playtomic/sync.ts`:
- `syncUserMatches(profileId: string, opts?: { force?: boolean })`:
  1. Читает `profiles.playtomic_user_id` и `playtomic_synced_at`. Если id пустой — выходит.
  2. Если `force !== true` и с последнего синка прошло < 10 минут — выходит.
  3. Тянет `fetchUserMatches`, фильтрует: `start_date >= now()` ИЛИ матч уже есть в нашей БД (чтобы обновить статус/счёт после игры).
  4. Апсёртит в `matches` по `(profile_id, playtomic_match_id)`. Поля переписываем кроме `reflection`.
  5. Если у матча в БД `end_date < now()` и есть `results` — выставляем `status = 'PLAYED'`.
  6. Записывает `playtomic_synced_at = now()`.
- `addMatchByUrl(profileId: string, url: string)` — парсит URL, тянет одиночный матч, апсёртит. Идёт мимо лимита 10 минут.

---

## UI

**Onboarding на профиле (`/profile` или часть `/settings` — уточнить в Task 3):**
- Если `playtomic_user_id` пуст — блок «Подключи Playtomic». Инпут под URL профиля, кнопка «Подключить». Server action парсит URL, дёргает `syncUserMatches(force=true)`, редиректит на `/matches`.

**`/matches`:**
- Тяжелее всего — Server Component, который вызывает `syncUserMatches(profileId)` перед рендерингом.
- Две вкладки: «Предстоящие» (status ∈ `PENDING`/`CONFIRMED`, отсортированы по `start_date asc`) и «Прошедшие» (остальные, по `start_date desc`).
- Карточка: дата, клуб, корт, 4 игрока с уровнями. Для предстоящих — число прикреплённых инсайтов или CTA «Поставь цели».
- Сверху: «Обновить» (форсит синк) и «Добавить по ссылке» (модалка).

**`/matches/[id]`:**
- Шапка: дата, клуб, корт.
- Команды: 4 игрока (выделить «меня»).
- Для предстоящего: блок «Цели на игру» — список прикреплённых инсайтов, кнопка «Прикрепить инсайт» (модалка с чекбоксами по коллекции инсайтов ученика).
- Для прошедшего: счёт, список инсайтов-целей (read-only), textarea «Как прошло?» — рефлексия.

**Карточка инсайта (расширение существующего UI):**
- Кнопка «Использовать на игре» → модалка со списком предстоящих матчей → выбор матча → запись в `match_goals`.

**Dashboard:**
- Новый блок «Актуальное»: предстоящие тренировки + ближайшие матчи в общем списке по дате. Мини-карточка матча, клик уводит на `/matches/[id]`.

**Тренер (`/trainer/students/[id]`):**
- Read-only блок «Матчи»: предстоящие и прошедшие. Видно прикреплённые инсайты-цели, видно рефлексии. Кнопок редактирования нет.

---

## Out of scope (явно откладываем)

- Отвязка Playtomic-профиля.
- Импорт исторических матчей (только начиная с момента подключения).
- Уведомления / напоминания.
- Аналитика «как часто инсайты становятся целями», «насколько часто рефлексии связаны с конкретными инсайтами».
- Возможность тренера редактировать матчи и прикреплять цели от имени ученика.
- Фоновый Vercel Cron для синхронизации.
- Связь матчей с тренировочными сессиями.

---

## Task breakdown

1. **Миграция БД** — поля в `profiles`, таблицы `matches` и `match_goals`.
2. **Playtomic client + types** — `src/lib/playtomic/client.ts` с парсингом URL и фетчами.
3. **Sync layer** — `src/lib/playtomic/sync.ts` (`syncUserMatches`, `addMatchByUrl`).
4. **Onboarding профиля** — UI и server action подключения Playtomic-профиля.
5. **Страница `/matches`** — список с вкладками, синк на входе, кнопки «Обновить» / «Добавить по ссылке».
6. **Страница `/matches/[id]`** — карточка матча, прикрепление инсайтов из матча.
7. **Обратная привязка из карточки инсайта** — «Использовать на игре» с выбором матча.
8. **Пост-матч UI** — счёт и поле рефлексии для прошедших.
9. **Блок «Актуальное» на dashboard** — объединённый список тренировок и матчей.
10. **Read-only блок матчей у тренера** — на `/trainer/students/[id]`.
11. **End-to-end smoke check** — реальный профиль, проверка автоимпорта, прикрепления инсайтов, рефлексии, тренерского вида.
