CREATE TABLE public.transcripts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  storage_path    TEXT,                          -- путь в bucket; NULL после удаления аудио
  audio_size_bytes BIGINT,
  duration_seconds INTEGER,
  raw_text        TEXT NOT NULL,
  segments_json   JSONB NOT NULL,
  stt_provider    TEXT NOT NULL,
  stt_model       TEXT NOT NULL,
  language        TEXT DEFAULT 'ru',
  status          TEXT NOT NULL DEFAULT 'processing',
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_transcripts_session ON public.transcripts(session_id);

COMMENT ON TABLE public.transcripts IS 'Транскрипт тренировки — 1:1 с sessions.';
COMMENT ON COLUMN public.transcripts.storage_path IS 'Путь к аудио в Storage; NULL после успешной транскрипции и удаления файла.';
COMMENT ON COLUMN public.transcripts.status IS 'processing | ready | failed';
