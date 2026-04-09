-- ============================================
-- Nivel MVP — Initial Schema
-- ============================================

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'trainer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Problem categories
CREATE TABLE public.problem_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Problems
CREATE TABLE public.problems (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL REFERENCES public.problem_categories(id),
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- Skills library
CREATE TABLE public.skills (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exercises library
CREATE TABLE public.exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Goals
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_count INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Goal-problem junction
CREATE TABLE public.goal_problems (
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  problem_id INT NOT NULL REFERENCES public.problems(id),
  PRIMARY KEY (goal_id, problem_id)
);

-- Sessions
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  session_number INT NOT NULL,
  trainer_notes TEXT,
  student_insight TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session exercises
CREATE TABLE public.session_exercises (
  id SERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercise_id INT NOT NULL REFERENCES public.exercises(id),
  sort_order INT NOT NULL DEFAULT 0
);

-- Skills per session exercise
CREATE TABLE public.session_exercise_skills (
  session_exercise_id INT NOT NULL REFERENCES public.session_exercises(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(id),
  PRIMARY KEY (session_exercise_id, skill_id)
);

-- Skill progress per user
CREATE TABLE public.skill_progress (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES public.skills(id),
  points INT NOT NULL DEFAULT 0,
  UNIQUE (user_id, skill_id)
);

-- Indexes
CREATE INDEX idx_goals_user_id ON public.goals(user_id);
CREATE INDEX idx_goals_status ON public.goals(status);
CREATE INDEX idx_sessions_goal_id ON public.sessions(goal_id);
CREATE INDEX idx_session_exercises_session ON public.session_exercises(session_id);
CREATE INDEX idx_skill_progress_user ON public.skill_progress(user_id);
CREATE INDEX idx_problems_category ON public.problems(category_id);

-- ============================================
-- Trigger: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email = 'profeshionalx@gmail.com' THEN 'trainer' ELSE 'student' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Function: increment skill progress
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_skill_progress(p_user_id UUID, p_skill_id INT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.skill_progress (user_id, skill_id, points)
  VALUES (p_user_id, p_skill_id, 1)
  ON CONFLICT (user_id, skill_id)
  DO UPDATE SET points = skill_progress.points + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper: is current user trainer?
-- ============================================
CREATE OR REPLACE FUNCTION public.is_trainer()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'trainer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- Row Level Security
-- ============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own profile or trainer sees all" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_trainer());
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Problem categories & problems (read-only for all authenticated)
ALTER TABLE public.problem_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories readable" ON public.problem_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Problems readable" ON public.problems
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Skills library
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Skills readable" ON public.skills
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Trainer inserts skills" ON public.skills
  FOR INSERT WITH CHECK (public.is_trainer());

-- Exercises library
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exercises readable" ON public.exercises
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Trainer inserts exercises" ON public.exercises
  FOR INSERT WITH CHECK (public.is_trainer());

-- Goals
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goals select" ON public.goals
  FOR SELECT USING (user_id = auth.uid() OR public.is_trainer());
CREATE POLICY "Goals insert own" ON public.goals
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Goals update" ON public.goals
  FOR UPDATE USING (user_id = auth.uid() OR public.is_trainer());

-- Goal problems
ALTER TABLE public.goal_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Goal problems select" ON public.goal_problems
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.goals WHERE goals.id = goal_problems.goal_id AND (goals.user_id = auth.uid() OR public.is_trainer()))
  );
CREATE POLICY "Goal problems insert" ON public.goal_problems
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.goals WHERE goals.id = goal_problems.goal_id AND goals.user_id = auth.uid())
  );

-- Sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions select" ON public.sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.goals WHERE goals.id = sessions.goal_id AND (goals.user_id = auth.uid() OR public.is_trainer()))
  );
CREATE POLICY "Trainer creates sessions" ON public.sessions
  FOR INSERT WITH CHECK (public.is_trainer());
CREATE POLICY "Sessions update" ON public.sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.goals WHERE goals.id = sessions.goal_id AND (goals.user_id = auth.uid() OR public.is_trainer()))
  );

-- Session exercises
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session exercises select" ON public.session_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.goals g ON g.id = s.goal_id
      WHERE s.id = session_exercises.session_id
      AND (g.user_id = auth.uid() OR public.is_trainer())
    )
  );
CREATE POLICY "Trainer creates session exercises" ON public.session_exercises
  FOR INSERT WITH CHECK (public.is_trainer());

-- Session exercise skills
ALTER TABLE public.session_exercise_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Session exercise skills select" ON public.session_exercise_skills
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_exercises se
      JOIN public.sessions s ON s.id = se.session_id
      JOIN public.goals g ON g.id = s.goal_id
      WHERE se.id = session_exercise_skills.session_exercise_id
      AND (g.user_id = auth.uid() OR public.is_trainer())
    )
  );
CREATE POLICY "Trainer creates session exercise skills" ON public.session_exercise_skills
  FOR INSERT WITH CHECK (public.is_trainer());

-- Skill progress
ALTER TABLE public.skill_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Skill progress select" ON public.skill_progress
  FOR SELECT USING (user_id = auth.uid() OR public.is_trainer());
CREATE POLICY "Skill progress insert" ON public.skill_progress
  FOR INSERT WITH CHECK (public.is_trainer());
CREATE POLICY "Skill progress update" ON public.skill_progress
  FOR UPDATE USING (public.is_trainer());
