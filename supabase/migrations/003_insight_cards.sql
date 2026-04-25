-- ============================================
-- Nivel — Insight Cards
-- ============================================

CREATE TABLE public.insight_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES public.profiles(id),
  problem_id INT REFERENCES public.problems(id) ON DELETE SET NULL,
  category_id INT REFERENCES public.problem_categories(id) ON DELETE SET NULL,
  front_text TEXT NOT NULL,
  context_text TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  trainer_status TEXT NOT NULL DEFAULT 'draft' CHECK (trainer_status IN ('draft', 'approved', 'rejected')),
  student_decision TEXT CHECK (student_decision IN ('taken', 'skipped')),
  student_edited_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE INDEX idx_insight_cards_student ON public.insight_cards(student_id, student_decision);
CREATE INDEX idx_insight_cards_session ON public.insight_cards(session_id);
CREATE INDEX idx_insight_cards_problem ON public.insight_cards(problem_id);
CREATE INDEX idx_insight_cards_category ON public.insight_cards(category_id);

-- Sessions: trainer review status (separate from student decisions)
ALTER TABLE public.sessions
  ADD COLUMN trainer_review_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- RLS for insight_cards
-- ============================================
ALTER TABLE public.insight_cards ENABLE ROW LEVEL SECURITY;

-- Student sees own cards (any trainer_status); trainer sees all
CREATE POLICY "Insight cards select" ON public.insight_cards
  FOR SELECT USING (student_id = auth.uid() OR public.is_trainer());

-- Trainer creates cards
CREATE POLICY "Trainer creates insight cards" ON public.insight_cards
  FOR INSERT WITH CHECK (public.is_trainer());

-- Trainer updates any field; student updates only decision/edit fields on their own approved cards
CREATE POLICY "Trainer updates insight cards" ON public.insight_cards
  FOR UPDATE USING (public.is_trainer());

CREATE POLICY "Student decides own insight cards" ON public.insight_cards
  FOR UPDATE USING (
    student_id = auth.uid() AND trainer_status = 'approved'
  );

CREATE POLICY "Trainer deletes insight cards" ON public.insight_cards
  FOR DELETE USING (public.is_trainer());
