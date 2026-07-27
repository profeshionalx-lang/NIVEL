ALTER TABLE public.insight_cards
  ADD COLUMN IF NOT EXISTS moment_before_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS moment_after_seconds  NUMERIC,
  ADD COLUMN IF NOT EXISTS frame_before_path TEXT,
  ADD COLUMN IF NOT EXISTS frame_after_path  TEXT;

COMMENT ON COLUMN public.insight_cards.frame_before_path IS
  'Путь объекта в bucket session-frames. НЕ URL: подписанный URL истекает, храним path и подписываем на чтении.';

COMMENT ON COLUMN public.insight_cards.frame_after_path IS
  'Путь объекта в bucket session-frames. НЕ URL: подписанный URL истекает, храним path и подписываем на чтении.';
