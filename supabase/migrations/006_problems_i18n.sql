-- ============================================
-- problems / problem_categories: store both languages.
-- name остаётся (для FTS и обратной совместимости),
-- появляются name_ru / name_en. Заполняются из текущего state (EN)
-- и из _*_ru_backup (RU, созданы миграцией 004).
-- ============================================

ALTER TABLE public.problem_categories
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_en text;

-- EN = текущее значение name (после миграции 004).
UPDATE public.problem_categories SET name_en = name WHERE name_en IS NULL;
UPDATE public.problems           SET name_en = name WHERE name_en IS NULL;

-- RU = снимок из бэкапов (id'ы сохранены).
UPDATE public.problem_categories c
   SET name_ru = b.name
  FROM public._problem_categories_ru_backup b
 WHERE b.id = c.id
   AND c.name_ru IS NULL;

UPDATE public.problems p
   SET name_ru = b.name
  FROM public._problems_ru_backup b
 WHERE b.id = p.id
   AND p.name_ru IS NULL;

-- На всякий случай — fallback в EN, если RU не нашёлся (новые строки).
UPDATE public.problem_categories SET name_ru = name_en WHERE name_ru IS NULL;
UPDATE public.problems           SET name_ru = name_en WHERE name_ru IS NULL;

ALTER TABLE public.problem_categories
  ALTER COLUMN name_ru SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL;

ALTER TABLE public.problems
  ALTER COLUMN name_ru SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL;
