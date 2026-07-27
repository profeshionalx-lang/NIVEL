-- v2 of replace_ai_draft_cards (NIVEL#239):
--  - writes moment_before_seconds / moment_after_seconds from p_cards
--  - returns JSONB {"inserted": <int>, "orphan_paths": [<text>, ...]} instead
--    of a bare INTEGER, so callers can clean up Storage objects belonging to
--    the drafts this call is about to delete (there's no DB→Storage cascade
--    in Supabase; a trainer may have already attached frames to a draft
--    before the session got re-analyzed).
--
-- Return type change (INTEGER -> JSONB) requires DROP FUNCTION before
-- CREATE OR REPLACE — Postgres does not allow changing a function's return
-- type in place.
DROP FUNCTION IF EXISTS public.replace_ai_draft_cards(UUID, UUID, UUID, JSONB);

CREATE OR REPLACE FUNCTION public.replace_ai_draft_cards(
  p_session_id UUID,
  p_student_id UUID,
  p_trainer_id UUID,
  p_cards JSONB
) RETURNS JSONB AS $$
DECLARE
  card JSONB;
  inserted_count INT := 0;
  orphan_paths TEXT[];
BEGIN
  -- Delete the previous batch of drafts for this session, collecting any
  -- frame paths they had attached so the caller can remove the Storage
  -- objects (this function only touches Postgres, never Storage itself).
  WITH deleted AS (
    DELETE FROM public.insight_cards
    WHERE session_id = p_session_id
      AND source = 'ai-paste'
      AND trainer_status = 'draft'
    RETURNING frame_before_path, frame_after_path
  )
  SELECT COALESCE(array_agg(p) FILTER (WHERE p IS NOT NULL), ARRAY[]::TEXT[])
  INTO orphan_paths
  FROM (
    SELECT frame_before_path AS p FROM deleted
    UNION ALL
    SELECT frame_after_path AS p FROM deleted
  ) paths;

  FOR card IN SELECT * FROM jsonb_array_elements(p_cards)
  LOOP
    INSERT INTO public.insight_cards (
      session_id, student_id, trainer_id, source, trainer_status,
      title, body, quote, tags, front_text, context_text,
      moment_before_seconds, moment_after_seconds
    ) VALUES (
      p_session_id,
      p_student_id,
      p_trainer_id,
      'ai-paste',
      'draft',
      card->>'title',
      card->>'body',
      card->>'quote',
      ARRAY[card->>'tag'],
      card->>'title',
      card->>'body',
      NULLIF(card->>'moment_before', '')::numeric,
      NULLIF(card->>'moment_after', '')::numeric
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', inserted_count,
    'orphan_paths', to_jsonb(orphan_paths)
  );
END;
$$ LANGUAGE plpgsql;
