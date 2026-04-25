-- ============================================
-- Seed: Insight cards from real training transcripts.
-- Batch 1 → first existing session (tempo / control)
-- Batch 2 → second existing session (Tibidabo / glass work)
--           If only one session exists, both batches go to it.
-- All cards land as 'approved' so the student can swipe them immediately.
-- Idempotent: skips if a card with the same front_text already exists in the session.
-- ============================================

DO $$
DECLARE
  v_trainer_id UUID;
  v_session_1  UUID;
  v_student_1  UUID;
  v_session_2  UUID;
  v_student_2  UUID;

  v_batch_1 TEXT[][] := ARRAY[
    ARRAY['Quick backswing, slow contact', 'On your level the rallies are objectively slow — players steal time from themselves with slow prep and a rushed strike. Reverse it.', 'Meta-skills'],
    ARRAY['Inhale → pause → strike', 'Pre-shot ritual on every ball.', 'Meta-skills'],
    ARRAY['Racket head down in defensive stance', 'From the back, never carry the racket head up.', 'Technical'],
    ARRAY['Hands together through the swing', 'Hands apart = shoulders desync = control gone.', 'Technical'],
    ARRAY['Left hand is the sight', 'Without it the next ball flies somewhere else every time.', 'Technical'],
    ARRAY['Freeze, hit, then move your feet', 'Don''t move feet during contact. Get to position earlier so you can stop.', 'Positioning'],
    ARRAY['Above shoulder → attack. Below shoulder → let it drop to the knee', 'Buys you half a second and lets you control the ball instead of striking on the rise.', 'Decision Making'],
    ARRAY['The block is a weapon, not a defense', 'You''re using the opponent''s power against them. Switch to blocks when they expect attacks.', 'Decision Making'],
    ARRAY['Block: still arm, racket close to body', 'No swinging. Just present the racket. Body provides support, not the outstretched arm.', 'Technical'],
    ARRAY['Aim blocks to the corners, not in front of you', 'Direction matters more than power on a block.', 'Decision Making'],
    ARRAY['Never lob from a hard position', '90% of those lobs come up short. A good lob only comes from an easy ball.', 'Decision Making'],
    ARRAY['After an attacking shot, priority #1 is recovery', 'Even at the cost of a slower next shot. Get back.', 'Positioning'],
    ARRAY['Hold 10 normal-tempo balls before trying to finish', 'Patience over winners.', 'Meta-skills'],
    ARRAY['Change tempo, not shot complexity', 'Be unpredictable through rhythm, not difficulty.', 'Meta-skills']
  ];

  v_batch_2 TEXT[][] := ARRAY[
    ARRAY['Number the walls 1–5 and plan the bounce', 'Side near = 1, next = 2, back = 3, then 4, single center wall = 5.', 'Decision Making'],
    ARRAY['Ball into wall #2 bounces to #3 — drift to the middle', 'Don''t chase the ball; it runs away from you.', 'Positioning'],
    ARRAY['Ball into wall #3 bounces to #2 — sprint forward', 'Otherwise the rebound passes you by.', 'Positioning'],
    ARRAY['Opponents hit angles off easy balls, middle off hard balls', 'Use this to anticipate position before they swing.', 'Decision Making'],
    ARRAY['Base position is the middle of your sector', 'From there you reach both the angle and the middle.', 'Positioning'],
    ARRAY['Steps, not arm — feet do the reach', 'The arm is already at maximum extension; only the feet can fix poor positioning.', 'Positioning'],
    ARRAY['Hit at the front foot', 'If your hand ends up ahead of your foot, you needed to step — not stretch.', 'Positioning'],
    ARRAY['Don''t wait for the wall rebound — chase as soon as the ball crosses you', 'Wait half a step and the angled rebound is gone.', 'Positioning'],
    ARRAY['Deep bounce runs forward; near-glass bounce dies in the corner', 'Read the bounce zone, then commit forward or to the corner.', 'Decision Making'],
    ARRAY['Volley and bandeja are the same shot — train them together', 'Same mechanics. Don''t split them in your head.', 'Technical'],
    ARRAY['Keep the elbow low on the volley', 'Lift it once and you spend the rest of the rally fixing the motion.', 'Technical'],
    ARRAY['Bandeja: left hand up as the sight, right hand bent behind the head', 'Without the bend, all power comes from the wrist alone.', 'Technical'],
    ARRAY['Power comes from body rotation, not the wrist', 'Open the chest sideways, hit with the whole body.', 'Technical'],
    ARRAY['Don''t guess — watch the ball', 'Anticipation comes from reading the ball, not predicting the opponent.', 'Meta-skills']
  ];

  v_row TEXT[];
  v_category_id INT;
BEGIN
  SELECT id INTO v_trainer_id FROM public.profiles
    WHERE role = 'trainer' ORDER BY created_at LIMIT 1;

  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'No trainer profile yet — skipping insight card seed.';
    RETURN;
  END IF;

  SELECT s.id, g.user_id INTO v_session_1, v_student_1
    FROM public.sessions s
    JOIN public.goals g ON g.id = s.goal_id
    ORDER BY s.created_at, s.session_number
    LIMIT 1;

  IF v_session_1 IS NULL THEN
    RAISE NOTICE 'No sessions yet — skipping insight card seed.';
    RETURN;
  END IF;

  SELECT s.id, g.user_id INTO v_session_2, v_student_2
    FROM public.sessions s
    JOIN public.goals g ON g.id = s.goal_id
    WHERE s.id <> v_session_1
    ORDER BY s.created_at, s.session_number
    LIMIT 1;

  IF v_session_2 IS NULL THEN
    v_session_2 := v_session_1;
    v_student_2 := v_student_1;
  END IF;

  -- Batch 1
  FOREACH v_row SLICE 1 IN ARRAY v_batch_1 LOOP
    SELECT id INTO v_category_id FROM public.problem_categories WHERE name = v_row[3];
    IF NOT EXISTS (
      SELECT 1 FROM public.insight_cards
      WHERE session_id = v_session_1 AND front_text = v_row[1]
    ) THEN
      INSERT INTO public.insight_cards (
        session_id, student_id, trainer_id, category_id,
        front_text, context_text, source, trainer_status
      ) VALUES (
        v_session_1, v_student_1, v_trainer_id, v_category_id,
        v_row[1], v_row[2], 'manual', 'approved'
      );
    END IF;
  END LOOP;

  -- Batch 2
  FOREACH v_row SLICE 1 IN ARRAY v_batch_2 LOOP
    SELECT id INTO v_category_id FROM public.problem_categories WHERE name = v_row[3];
    IF NOT EXISTS (
      SELECT 1 FROM public.insight_cards
      WHERE session_id = v_session_2 AND front_text = v_row[1]
    ) THEN
      INSERT INTO public.insight_cards (
        session_id, student_id, trainer_id, category_id,
        front_text, context_text, source, trainer_status
      ) VALUES (
        v_session_2, v_student_2, v_trainer_id, v_category_id,
        v_row[1], v_row[2], 'manual', 'approved'
      );
    END IF;
  END LOOP;

  -- Mark trainer review as completed for both sessions so cards are visible to student
  UPDATE public.sessions SET trainer_review_completed = TRUE
    WHERE id IN (v_session_1, v_session_2);
END $$;
