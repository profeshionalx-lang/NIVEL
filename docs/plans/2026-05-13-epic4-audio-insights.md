# Epic 4 — Audio → Insights

**Дата:** 2026-05-13
**Статус:** план эпика (готов к декомпозиции в GitHub issues)
**Базовый research:** [`2026-05-13-audio-insights-research.md`](./2026-05-13-audio-insights-research.md)

---

## Цель

После каждой тренировки тренер загружает часовую аудиозапись в Nivel и получает:
- **MVP:** машинный транскрипт на русском, размеченный по сегментам с таймкодами. Тренер читает транскрипт и **руками** создаёт insight-карточки через существующий inline-adder.
- **v2:** AI-черновики insight-карточек, которые тренер ревьюит/редактирует/аппрувит.
- **v3:** диаризация для групповых тренировок.

---

## Решённые архитектурные вопросы

| Вопрос | Решение | Источник |
|--------|---------|----------|
| STT-движок | **Groq `whisper-large-v3`** без промпта | Pilot 2026-05-13 (research §8) |
| Цена/тренировку | ~$0.04 (STT only); ~$0.12 с LLM v2 | research §3 |
| Скорость | 12–20 сек на 1 ч аудио | Pilot |
| Vercel 300s timeout | помещается в один route handler (STT < 60s) — **очередь НЕ нужна для MVP** | Pilot |
| LLM (v2) | `anthropic/claude-sonnet-4.6` через Vercel AI Gateway, `generateObject` + Zod | research §3 |
| Хранилище аудио | Supabase Storage bucket `session-audio` | research §4 |
| Постпроцессинг | regex-фильтр Whisper-галлюцинаций + fuzzy-glossary падел-терминов | Pilot |

---

## Архитектура MVP

```
[Тренер: drag&drop m4a/mp3 на /sessions/[id]]
        │
        ▼
Direct upload → Supabase Storage (session-audio/{session_id}/{uuid}.m4a)
        │
        ▼
Server Action: transcribeSession(sessionId, storagePath)
   1. Скачать аудио из Storage в memory
   2. POST → Groq Whisper-large-v3 (~15s)
   3. Постпроцессинг: фильтр галлюцинаций, glossary
   4. INSERT transcripts (session_id, raw_text, segments_json, ...)
        │
        ▼
Клиент опрашивает или Realtime → редирект на /sessions/[id]/transcript
        │
        ▼
UI: транскрипт по сегментам с таймкодами,
   подсветка низкоуверенных, кнопка «создать инсайт из этого фрагмента»
        │
        ▼
[Тренер: выделяет фразу → создаёт insight_card вручную]
   (используем существующий inline-adder + автозаполнение quote из выделения)
```

---

## БД-изменения

### Миграция `010_session_transcripts.sql`

```sql
CREATE TABLE public.transcripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,             -- path в bucket session-audio
  audio_size_bytes BIGINT,
  duration_seconds INTEGER,
  raw_text        TEXT NOT NULL,             -- сплошной текст
  segments_json   JSONB NOT NULL,            -- массив {start, end, text, avg_logprob}
  stt_provider    TEXT NOT NULL,             -- 'groq-whisper-large-v3'
  stt_model       TEXT NOT NULL,
  language        TEXT DEFAULT 'ru',
  status          TEXT NOT NULL DEFAULT 'ready',  -- 'processing' | 'ready' | 'failed'
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_transcripts_session ON public.transcripts(session_id);

COMMENT ON TABLE public.transcripts IS 'Транскрипт тренировки — 1:1 с sessions.';
```

### Storage bucket `session-audio`

- Private (доступ только через signed URLs)
- Policy: только владелец сессии (тренер) может upload/read
- TTL подписи: 1 час для upload

---

## Issue breakdown (MVP)

Зависимости показаны стрелками `→`. Issues помеченные `[P]` можно делать параллельно.

### Phase 1 — Foundation

**Issue #M1 [P] — DB: миграция `010_session_transcripts.sql` + Supabase Storage bucket**
- Создать миграцию (см. выше)
- Через Management API применить
- Создать bucket `session-audio` (private)
- Прописать RLS-эквиваленты или storage policies (наш паттерн — через service role + проверки в app)
- **Файлы:** `supabase/migrations/010_session_transcripts.sql`
- **Acceptance:** `SELECT * FROM transcripts LIMIT 0;` работает; bucket виден в dashboard

**Issue #M2 [P] — env: добавить `GROQ_API_KEY`**
- Добавить переменную в Vercel (preview + prod) и `.env.local.example`
- Документировать в CLAUDE.md под секцией "ENV переменные"
- **Файлы:** `.env.local.example`, `CLAUDE.md`
- **Acceptance:** `process.env.GROQ_API_KEY` доступен в dev

### Phase 2 — Upload UI

**Issue #M3 — Upload-блок на `/sessions/[id]`** → требует #M1
- Drag&drop зона + кнопка «Загрузить аудио»
- Валидация: MIME `audio/*`, размер ≤ 100MB
- Direct upload в Supabase Storage через signed URL (получаем через Server Action `requestAudioUploadUrl`)
- Progress bar (XHR upload событие)
- После успеха — тригерим Server Action `transcribeSession`
- **Файлы:** `src/app/sessions/[id]/page.tsx`, `src/app/sessions/[id]/AudioUploader.tsx` (новый), `src/lib/actions/audio.ts` (новый)
- **Acceptance:** загрузил файл → видно в Storage → Server Action вызван

### Phase 3 — STT pipeline

**Issue #M4 — Groq STT client + Server Action `transcribeSession`** → требует #M1, #M2, #M3
- `src/lib/stt/groq.ts` — обёртка над Groq API (модель `whisper-large-v3`, response_format `verbose_json`)
- Server Action: качает аудио из Storage, шлёт в Groq, инсертит в `transcripts`
- Перевод `status` через стадии: `processing` → `ready`/`failed`
- **После успешной транскрипции — удалить файл из Storage** (см. решение #3)
- Catch и логгирование ошибок Groq (rate limit, file size, etc.)
- **Файлы:** `src/lib/stt/groq.ts`, `src/lib/actions/audio.ts`
- **Acceptance:** загрузка часового файла → через ~20 сек в `transcripts` лежит запись со статусом `ready`, файл в Storage удалён

**Issue #M5 [P] — Постпроцессинг транскрипта**
- `src/lib/stt/postprocess.ts`:
  - Фильтр известных Whisper-галлюцинаций (regex по списку: «Субтитры сделал.*», «Продолжение следует», «Подписывайтесь...», «DimaTorzok» и т.п.)
  - Fuzzy-glossary падел-терминов: словарь `{ canonical: [misheard_patterns] }` — `бандеха ← бомбех|пандех|бамдех|...`
  - Применяется к `raw_text` И к `segments_json[].text` перед сохранением
- Unit-тесты на фикстурах из пилота (артефакты в `~/Downloads/...v3-noprompt.json`)
- **Файлы:** `src/lib/stt/postprocess.ts`, `src/lib/stt/glossary.ts`, `src/lib/stt/__tests__/postprocess.test.ts`
- **Acceptance:** на v3-noprompt.json — нет «Субтитры сделал DimaTorzok», «бомбеху» → «бандеху»

### Phase 4 — Transcript UI

**Issue #M6 — Страница `/sessions/[id]/transcript`** → требует #M4
- Server Component, читает transcript по `session_id`
- Три вкладки: «По сегментам» / «Сплошной текст» / «Аудио-плеер»
- Сегменты с таймкодами, подсветка низкой уверенности (`avg_logprob < -0.6`)
- Кнопка «Создать инсайт из фрагмента» (выделил текст → открывается inline-adder с pre-filled `quote`)
- Состояние `processing`: skeleton + опрос статуса каждые 3 секунды (или Supabase Realtime подписка)
- Состояние `failed`: показать ошибку + кнопку «Попробовать снова»
- **Файлы:** `src/app/sessions/[id]/transcript/page.tsx`, `src/app/sessions/[id]/transcript/TranscriptView.tsx`
- **Acceptance:** открыл `/sessions/[id]/transcript` → видишь сегменты → выделил → создал insight-карточку с цитатой

~~**Issue #M7 — Аудио-плеер с синхронизацией сегментов**~~ — **исключено из MVP** (аудио не хранится, см. решение #3).

### Phase 5 — Polish

**Issue #M8 — Кнопка «Re-transcribe»** → требует #M4
- На странице транскрипта — кнопка «Перетранскрибировать» (если результат не устраивает)
- Удаляет старый transcript, запускает заново
- **Файлы:** `src/app/sessions/[id]/transcript/page.tsx`

**Issue #M9 — Удаление транскрипта** → требует #M1
- Server Action `deleteTranscript(sessionId)`: удаляет запись + файл из Storage
- Кнопка в UI с подтверждением
- **Файлы:** `src/lib/actions/audio.ts`

---

## Issue breakdown (v2 — LLM auto-insights)

После MVP, когда транскрипт стабильно работает.

**Issue #V1 — Vercel AI Gateway setup + `@ai-sdk/anthropic` / `ai`**
- `vercel ai gateway add anthropic`
- `npm i ai @ai-sdk/anthropic zod`
- `env`: `AI_GATEWAY_API_KEY`
- Smoke-test через `generateText`

**Issue #V2 — Zod-схема + промпт `extractInsights(transcript)`**
- `src/lib/ai/schemas.ts` — `InsightBatchSchema` (см. research §3)
- `src/lib/ai/prompts.ts` — system prompt с few-shot, теги, обязательная цитата
- `src/lib/ai/extractInsights.ts` — two-stage prompt chain
- Unit-тест на одном транскрипте из пилота: ожидаем 5–15 карточек с цитатами

**Issue #V3 — Server Action `generateInsightDrafts(sessionId)`**
- Дергается после `transcribeSession` (или вручную кнопкой)
- Пишет insight_cards с `source='ai'`, `trainer_status='draft'`
- Streaming через `streamObject` для лучшего UX

**Issue #V4 — UI ревью AI-черновиков**
- На странице сессии — секция «AI-черновики» с карточками `trainer_status='draft'`
- Кнопки: Approve / Edit / Reject
- Approve → `trainer_status='approved'`, видно ученику
- Reject → удаление или `trainer_status='rejected'`

**Issue #V5 — Async-pipeline через Vercel Queues**
- Если LLM-этап начнёт превышать 60 сек или захотим автоматический trigger after upload — переезд в Queues
- Step 1: STT, Step 2: postprocess, Step 3: LLM

---

## v3 — Диаризация (отдельный эпик позже)

- Replicate WhisperX / pyannote
- Speaker labels в `segments_json`
- UI: фильтр сегментов по спикеру
- Привязка AI-инсайтов к конкретному ученику (для группы)

---

## Утверждённые решения (2026-05-13)

1. **Один файл на сессию.** Если тренер записал в 2 устройства — мержит руками в аудиоредакторе перед загрузкой.
2. **Tracking прогресса: polling каждые 3 секунды.** Проще, без настройки Realtime-канала.
3. **Аудио не хранится.** Удаляется сразу после успешной транскрипции.
   - Storage используется только как **временный буфер** для передачи файла от клиента к серверу.
   - Транскрипт (текст в БД) хранится **бессрочно**.
   - **Последствия:**
     - На странице транскрипта **нет аудио-плеера** (issue #M7 убирается из MVP).
     - Re-transcribe (#M8) = перезалить файл заново.
     - Нулевые затраты на Storage, free план Supabase без давления.
4. **Лимит размера: 100MB.** Час m4a ≈ 22MB, запас в 5× хватит и на 4 часа.
5. **Доступ к транскрипту:** только тренер сессии. Ученику — только approved insight_cards.

---

## Roadmap

| Phase | Issues | Оценка | Готов |
|-------|--------|--------|--------|
| MVP Foundation | #M1, #M2 | 0.5 дня | — |
| MVP Upload | #M3 | 1 день | — |
| MVP STT | #M4, #M5 | 1.5 дня | — |
| MVP UI | #M6 | 1 день | — |
| MVP Polish | #M8, #M9 | 0.5 дня | — |
| **Итого MVP** | **8 issues** | **~4.5 дня** | — |
| v2 LLM | #V1–#V5 | ~5 дней | после MVP |
| v3 Diarization | отдельный эпик | — | после первых матчей с группой |

---

## Next step

1. Утвердить план → создать GitHub epic-issue с этим текстом
2. Декомпозировать на 9 child issues (#M1–#M9), проставить `ready-for-agent` на parallel-friendly (#M1, #M2)
3. Закоммитить research-doc + pilot scripts в новую ветку, мерджить в main как `docs(plans)`
