-- Auto-analysis of transcripts via LLM (Phase 1).
-- Tracks the state of the automatic insight-extraction step that runs after STT.

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS analysis_error text;

ALTER TABLE public.transcripts
  DROP CONSTRAINT IF EXISTS transcripts_analysis_status_check;

ALTER TABLE public.transcripts
  ADD CONSTRAINT transcripts_analysis_status_check
  CHECK (analysis_status IN ('idle', 'processing', 'ready', 'failed'));

COMMENT ON COLUMN public.transcripts.analysis_status IS
  'idle | processing | ready | failed — статус LLM-анализа транскрипта';
COMMENT ON COLUMN public.transcripts.analysis_error IS
  'Текст ошибки последней неудачной попытки анализа';
