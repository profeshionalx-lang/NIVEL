CREATE OR REPLACE FUNCTION public.replace_ai_draft_cards(
  p_session_id UUID,
  p_student_id UUID,
  p_cards JSONB
) RETURNS INTEGER AS $$
DECLARE
  card JSONB;
  inserted_count INT := 0;
BEGIN
  DELETE FROM public.insight_cards
  WHERE session_id = p_session_id
    AND source = 'ai-paste'
    AND trainer_status = 'draft';

  FOR card IN SELECT * FROM jsonb_array_elements(p_cards)
  LOOP
    INSERT INTO public.insight_cards (
      session_id, student_id, source, trainer_status,
      title, body, quote, tags, front_text, context_text
    ) VALUES (
      p_session_id,
      p_student_id,
      'ai-paste',
      'draft',
      card->>'title',
      card->>'body',
      card->>'quote',
      ARRAY[card->>'tag'],
      card->>'title',
      card->>'body'
    );
    inserted_count := inserted_count + 1;
  END LOOP;

  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;
