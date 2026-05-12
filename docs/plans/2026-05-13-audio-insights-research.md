# Epic 4 (research): Audio → Insights pipeline

**Date:** 2026-05-13
**Status:** research / pre-design

## Идея эпика

После каждой тренировки тренер получает часовое аудио. Цель: автоматически транскрибировать его на русский и сгенерировать черновики insight-карточек, которые тренер ревьюит/редактирует/аппрувит и отправляет ученику.

Текущая боль: инсайты "теряются" внутри часовой записи, тренер не успевает их выписывать вручную.

## Constraints

- RU-язык, падел-терминология (бандеха, вибора, смэш, пала, аламбре, трахте...)
- Серверлесс-стек: Next.js 16 на Vercel (300s function timeout), Supabase
- Бюджет MVP: **$0.30–$1 за одну часовую тренировку**
- Скорость не критична: можно ждать 10–30 минут
- MVP: один спикер (тренер с петличкой). Диаризация — v2.
- LLM-инсайты опциональны на старте — сначала важна качественная транскрипция.

---

## ✅ TL;DR — что закладываем в эпик

- **STT**: Groq `whisper-large-v3` без промпта + постпроцессинг (фильтр галлюцинаций + fuzzy-glossary). **~$0.04/час, 12 сек обработки**.
- **LLM**: `anthropic/claude-sonnet-4.6` через Vercel AI Gateway, `generateObject` + Zod схема. **~$0.08/тренировка**.
- **Async**: Vercel Queues (beta) или Inngest для оркестрации STT → LLM пайплайна.
- **БД**: новая таблица `transcripts` (1:1 с sessions) + reuse `insight_cards` (`source='ai'`, `trainer_status='draft'`).
- **Бюджет на тренировку: ~$0.12** (STT $0.04 + LLM $0.08).
- **Диаризация — v2** (Replicate + WhisperX).

Подробности по выбору STT — в разделе 8 (Pilot-эксперимент 2026-05-13).

---

## 1. Транскрибация (STT): сравнение

| Сервис                            | $/час  | RU WER         | Glossary           | Async        | Diarization | File limit |
|-----------------------------------|--------|----------------|--------------------|--------------|-------------|------------|
| **ElevenLabs Scribe v1**          | $0.22  | **3.1%** (FLEURS) | `keyterms` (+$0.05/ч) | sync        | ✅          | нет        |
| **Yandex SpeechKit (async)**      | ~$0.18 | ~3–5% (нативный RU) | ❌                 | ✅ async     | ❌          | 4 часа     |
| **Deepgram Nova-3**               | $0.31 (batch) | ~5–6%   | `keywords` + boost | ✅ webhook   | ✅ (+$0.06/ч)| нет        |
| **AssemblyAI Universal-2**        | $0.27  | ~6%            | ❌                 | ✅ async     | ✅ (+$0.12/ч)| нет        |
| **OpenAI gpt-4o-transcribe**      | $0.36  | ~7–8%          | `prompt` (224 tok) | sync         | ❌          | **25 MB**  |
| **OpenAI whisper-1**              | $0.36  | ~10–12%        | `prompt`           | sync         | ❌          | **25 MB**  |
| **Groq Whisper large-v3-turbo**   | **$0.04** | ~8%         | `prompt`           | sync, 216× RT| ❌          | 25 MB      |
| **fal.ai Wizper**                 | $0.03  | ~8%            | `prompt`           | ✅ webhook   | ❌          | нет        |
| **Google Chirp 2 (Dynamic Batch)**| $0.24  | ~7%            | ❌                 | ✅ BatchRecognize | платно | нет        |
| **Azure Speech (batch)**          | $0.18  | ~7%            | custom endpoint    | ✅ async     | ✅ (free)   | нет        |
| **Replicate/Modal Whisper-v3**    | $0.05–0.15 | ~8–10%     | `prompt`           | ✅ async     | через WhisperX | нет     |
| **Локально Mac M-series**         | **$0** | ~8–10%         | `initial_prompt`   | оффлайн      | через WhisperX | —       |

### Recommendation

**MVP:** **ElevenLabs Scribe** — лучшее RU-качество из коммерческих API, glossary через `keyterms` для падел-сленга, нет лимита длины, $0.22/час.
**Upgrade-path (диаризация, v2):** **Deepgram Nova-3** — нативный async webhook, diarization из коробки.
**Zero-budget pilot:** локально `whisper.cpp` на Mac (large-v3) с `initial_prompt` падел-терминов.

---

## 2. Async-архитектура на Vercel

Часовой файл нельзя обработать в одном route handler (300s). Варианты:

1. **Vercel Queues** (beta, нативно) — лучший выбор для Next.js на Vercel.
2. **Inngest** — durable workflows, step-based, отличный DX.
3. **Trigger.dev / Upstash QStash** — альтернативы.
4. **Supabase Edge Functions + pg_cron** — если хочется держать всё в Supabase.

Для STT с webhook-режимом (Deepgram/AssemblyAI/fal.ai/Google Batch): сразу отдать задачу провайдеру и принять callback. Для ElevenLabs (sync): запустить через Vercel Queues, дождаться, записать результат.

---

## 3. LLM для генерации инсайтов

| Модель                          | Input ($/MTok) | Output ($/MTok) | За тренировку (15k+2k) | RU      |
|---------------------------------|----------------|------------------|------------------------|---------|
| **anthropic/claude-sonnet-4.6** | $3             | $15              | **$0.075**             | 🏆       |
| anthropic/claude-opus-4.7       | $5             | $25              | $0.125                 | 🏆       |
| google/gemini-2.5-flash         | $0.30          | $2.50            | **$0.009**             | хорошо  |
| openai/gpt-4.1                  | $2             | $8               | $0.046                 | хорошо  |
| openai/gpt-4o                   | $2.50          | $10              | $0.057                 | хорошо  |

**Recommendation:** `anthropic/claude-sonnet-4.6` через **Vercel AI Gateway** (единый ключ, failover, observability). Если нужно удешевить — `gemini-2.5-flash` в 8× дешевле.

### Архитектура промпт-цепочки

**Two-stage** (лучше single-pass для часа разговора):

1. **Extract**: транскрипт → сырые наблюдения тренера (20–30 штук).
2. **Structure**: наблюдения → дедупликация + структурирование в `insight_cards`.

Map-reduce оправдан только при >4 часах записи.

### Zod schema

```ts
import { z } from "zod";

const InsightTagSchema = z.enum(["техника", "тактика", "физика", "ментал"]);

export const InsightCardDraftSchema = z.object({
  title: z.string().max(80),
  body: z.string().max(400),
  tags: z.array(InsightTagSchema).min(1).max(3),
  quote: z.string().optional(),         // якорь против галлюцинаций
  timestamp_ref: z.string().optional(), // "14:32"
});

export const InsightBatchSchema = z.object({
  insights: z.array(InsightCardDraftSchema).min(3).max(15),
});
```

Использовать `generateObject` из Vercel AI SDK (предпочтительнее tool use для чистого structured output).

### Промпт-принципы

- **Few-shot обязателен** (без примеров модель пишет пересказ, а не actionable советы).
- **`quote` обязателен** — якорь против галлюцинаций; нет цитаты → инсайт невалиден.
- **Actionable filter**: "только то, что ученик может применить на следующей тренировке".
- **Теги**: техника / тактика / физика / ментал — с определениями в системном промпте.

---

## 4. Хранение в Supabase

Существующая `insight_cards` уже имеет `source='ai'` и `trainer_status='draft'` — готова под AI-черновики.

Добавить:

```sql
CREATE TABLE transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  raw_text text NOT NULL,
  storage_path text,             -- путь в Supabase Storage (audio)
  duration_seconds integer,
  stt_provider text,             -- 'elevenlabs' | 'deepgram' | ...
  created_at timestamptz DEFAULT now()
);
```

Связь: `sessions` → `transcripts` (1:1) → `insight_cards` (1:N через `session_id`).
Embeddings (pgvector) — не нужны для MVP, добавить позже для поиска по карточкам.

---

## 5. Предлагаемая архитектура MVP

```
[Тренер: upload MP3/M4A через UI Nivel]
        │
        ▼
Supabase Storage (signed URL)
        │
        ▼
POST /api/transcribe ──enqueue──►  Vercel Queues
                                        │
                                        ▼
                                ElevenLabs Scribe API
                                (keyterms: бандеха, вибора,
                                 смэш, пала, аламбре, ...)
                                        │
                                        ▼
                                INSERT transcripts
                                        │
                                        ▼
                                AI Gateway:
                                anthropic/claude-sonnet-4.6
                                generateObject(InsightBatchSchema)
                                two-stage prompt chain
                                        │
                                        ▼
                                INSERT insight_cards
                                  source='ai',
                                  trainer_status='draft'
                                        │
                                        ▼
                          Supabase Realtime → клиент
                                        │
                                        ▼
[Тренер: review/edit/approve/reject]
                                        │
                                        ▼
[Ученик видит approved карточки в /insights]
```

**Бюджет за тренировку:** ~$0.22 (STT) + ~$0.08 (LLM) = **~$0.30/тренировка**.

---

## 6. Аналоги в мире

- **Fireflies AI / tl;dv** — action items + summary для митингов, нет домена паделя, нет review-flow тренер→ученик.
- **Otter AI** — транскрипция + highlights, общий домен.
- **Granola** — AI-нотс встреч, ближайший по UX.

**Differentiator Nivel:** доменная модель (техника/тактика/физика/ментал), интеграция с sessions/goals/students, review-flow тренер→ученик.

---

## 7. Открытые развилки (перед началом эпика)

- **STT-движок**: ElevenLabs Scribe vs Yandex SpeechKit (после pilot-эксперимента).
- **Async-механика**: Vercel Queues (beta) vs Inngest vs Supabase Edge Functions.
- **UX загрузки**: drag&drop в карточку session vs отдельная страница `/sessions/[id]/upload` vs запись прямо в PWA.
- **Tracking прогресса**: polling vs Supabase Realtime vs SSE-стрим.
- **Регенерация инсайтов**: хранить версии? разрешать тренеру перегенерить с другим промптом?
- **Включать ли LLM-stage в MVP** или ограничиться только транскриптом + ручные инсайты?

---

## 8. Pilot-эксперимент (2026-05-13) — результаты

Прогнали 58-минутную тренировку (Ваня Куд) через несколько движков. Скрипт: `scripts/transcribe-pilot.mjs`.

### Прогоны

| Версия | Движок | Промпт | Время | Низк.увер. | Заметки |
|--------|--------|--------|-------|------------|---------|
| v1     | Groq whisper-large-v3-turbo | старый («Термины: ...») | 28.8s | 97/360 | Фантом «Термины» вылезает в текст |
| v2-turbo | Groq turbo | новый (без «Термины:») | 14.2s | 35/388 | Галлюцинация «Субтитры создавал DimaTorzok» |
| v2-large | Groq whisper-large-v3 | новый | 17.6s | 2/260 | Промпт повторяется ×30 раз в тишине (катастрофа) |
| **v3-noprompt** | **Groq whisper-large-v3** | **пустой** | **12.6s** | **4/630** | **Чисто, с пунктуацией, термины узнаются естественно** |
| Yandex SpeechKit (для сравнения) | Yandex | — | — | — | Каждая фраза дублируется ×2, нет пунктуации, термины искажены |

### Ключевые выводы

1. **Whisper-prompt — это не glossary, а контекст.** Whisper заполняет тишину фразами из промпта. Использовать промпт **запрещено** или максимум 1-2 слова.
2. **`whisper-large-v3` без промпта — лучшая конфигурация.** 12 секунд на час аудио, 4 низкоуверенных сегмента из 630.
3. **Yandex SpeechKit проиграл по всем параметрам** (нет пунктуации, дубли фраз, искажения терминов). Не берём.
4. **Известная Whisper-галлюцинация на тишине**: «Субтитры сделал DimaTorzok», «Продолжение следует...» — убирается простым regex-фильтром.
5. **Падел-термины**: частые узнаются (бандеха, чикита, форхенд, бэкхенд, стекло), редкие пропускаются (вибора, глоба, аламбре). Решение — постпроцессинг с fuzzy-match по канонической glossary, а не промпт.

### Финальный выбор для эпика

- **STT**: **Groq `whisper-large-v3`** (без turbo, без промпта)
- **Цена**: **$0.04/час** на платном Dev tier, **$0** на free tier (до 2 ч аудио/час). На 100 тренировок в месяц = **$4**.
- **Скорость**: ~12-20 секунд на часовое аудио
- **Постпроцессинг** (мини-step после STT):
  - Regex-фильтр известных Whisper-галлюцинаций («Субтитры сделал...», «Продолжение следует», «Подписывайтесь...»)
  - Fuzzy-match glossary: `бомбех|пандех|бандех` → `бандеха`, `чек-гилл|чикит` → `чикита`, и т.д.
- **Диаризация — v2** через Replicate (WhisperX + pyannote) когда понадобятся групповые тренировки.

### Артефакты пилота

- `scripts/transcribe-pilot.mjs` — скрипт CLI (Node 25, без зависимостей)
- `scripts/transcript-to-html.mjs` — рендер verbose_json в HTML с подсветкой неуверенных сегментов
- Транскрипты в `~/Downloads/29 апр. в 11-05 Ваня Куд.*.{txt,json,html}` (вне репо)

Если качество ElevenLabs устраивает — закладываем в эпик. Иначе пробуем Yandex SpeechKit.
