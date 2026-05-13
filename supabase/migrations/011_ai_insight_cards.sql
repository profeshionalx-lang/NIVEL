-- Epic 5: add columns for AI paste-from-Claude cards

ALTER TABLE public.insight_cards
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS quote TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Expand source CHECK to include 'ai-paste'
ALTER TABLE public.insight_cards
  DROP CONSTRAINT IF EXISTS insight_cards_source_check;

ALTER TABLE public.insight_cards
  ADD CONSTRAINT insight_cards_source_check
    CHECK (source IN ('manual', 'ai', 'ai-paste'));
