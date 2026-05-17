ALTER TABLE public.insight_cards
  ADD COLUMN IF NOT EXISTS template_id UUID;

CREATE INDEX IF NOT EXISTS idx_insight_cards_template_id
  ON public.insight_cards (template_id)
  WHERE template_id IS NOT NULL;

-- Backfill: assign the same template_id to all cards sharing (title, body).
-- Uses a CTE to generate one stable UUID per unique pair before joining back.
WITH unique_pairs AS (
  SELECT DISTINCT ON (title, body) title, body
  FROM insight_cards
  WHERE title IS NOT NULL AND body IS NOT NULL AND template_id IS NULL
  ORDER BY title, body
),
with_ids AS (
  SELECT title, body, gen_random_uuid() AS tid
  FROM unique_pairs
)
UPDATE insight_cards
SET template_id = with_ids.tid
FROM with_ids
WHERE insight_cards.title = with_ids.title
  AND insight_cards.body = with_ids.body
  AND insight_cards.template_id IS NULL;
