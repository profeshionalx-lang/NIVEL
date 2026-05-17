CREATE TABLE IF NOT EXISTS public.insight_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.insight_collection_cards (
  collection_id UUID NOT NULL REFERENCES public.insight_collections(id) ON DELETE CASCADE,
  template_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_insight_collections_trainer
  ON public.insight_collections (trainer_id);

CREATE INDEX IF NOT EXISTS idx_collection_cards_collection
  ON public.insight_collection_cards (collection_id);
