-- Migration 009: Playtomic matches integration
-- Extends profiles with Playtomic user id + sync timestamp.
-- Creates matches and match_goals tables.

-- ── 1. Extend profiles ──────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS playtomic_user_id   text,
  ADD COLUMN IF NOT EXISTS playtomic_synced_at timestamptz;

-- ── 2. Create matches ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  playtomic_match_id  text          NOT NULL,
  start_date          timestamptz   NOT NULL,
  end_date            timestamptz,
  location            text,
  resource_name       text,
  status              text,
  teams               jsonb,
  results             jsonb,
  reflection          text,
  last_synced_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (profile_id, playtomic_match_id)
);

-- ── 3. Create match_goals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_goals (
  match_id    uuid NOT NULL REFERENCES matches(id)  ON DELETE CASCADE,
  insight_id  uuid NOT NULL REFERENCES insight_cards(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, insight_id)
);
