UPDATE public.insight_cards
SET tags = array_replace(tags, 'ментал', 'менталка')
WHERE 'ментал' = ANY(tags);
