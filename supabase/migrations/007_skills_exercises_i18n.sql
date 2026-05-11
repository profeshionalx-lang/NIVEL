-- skills и exercises тоже хранятся в обеих локалях.
-- name остаётся (для обратной совместимости), name_ru / name_en заполняются.

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_en text;

ALTER TABLE public.exercises
  ADD COLUMN IF NOT EXISTS name_ru text,
  ADD COLUMN IF NOT EXISTS name_en text;

UPDATE public.skills    SET name_en = name WHERE name_en IS NULL;
UPDATE public.exercises SET name_en = name WHERE name_en IS NULL;

-- Skills RU
UPDATE public.skills SET name_ru = 'Бандеха'               WHERE id = 1  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Позиция у сетки'       WHERE id = 2  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Тактика атаки'         WHERE id = 3  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Концентрация'          WHERE id = 4  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Удары сверху'          WHERE id = 5  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Позиционирование'      WHERE id = 6  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Работа ног'            WHERE id = 7  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Коммуникация'          WHERE id = 8  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Принятие решений'      WHERE id = 9  AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Тактика'               WHERE id = 10 AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Игра от стекла'        WHERE id = 11 AND name_ru IS NULL;
UPDATE public.skills SET name_ru = 'Защита'                WHERE id = 12 AND name_ru IS NULL;

-- Exercises RU (известные seed-значения; для остальных fallback EN)
UPDATE public.exercises SET name_ru = 'Два мяча в угол'    WHERE id = 1 AND name_ru IS NULL;
UPDATE public.exercises SET name_ru = 'Воллей и бандеха'   WHERE id = 2 AND name_ru IS NULL;

-- Fallback: RU = EN, если перевод не задан.
UPDATE public.skills    SET name_ru = name_en WHERE name_ru IS NULL;
UPDATE public.exercises SET name_ru = name_en WHERE name_ru IS NULL;

ALTER TABLE public.skills
  ALTER COLUMN name_ru SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL;

ALTER TABLE public.exercises
  ALTER COLUMN name_ru SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL;
