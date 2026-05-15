-- ============================================
-- 008 — Shadow student profiles + claim tokens
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS firebase_uid     TEXT,
  ADD COLUMN IF NOT EXISTS claim_token      TEXT,
  ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claimed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Email is now optional: shadow rows are created with email = NULL,
-- and the claim flow writes the real Firebase email at first sign-in.
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

-- A firebase_uid can map to at most one profile.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_firebase_uid_key
  ON public.profiles(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

-- A claim_token is unique while live.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_claim_token_key
  ON public.profiles(claim_token)
  WHERE claim_token IS NOT NULL;

-- Lookup index for the claim landing page.
CREATE INDEX IF NOT EXISTS idx_profiles_claim_token ON public.profiles(claim_token);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by  ON public.profiles(created_by);

COMMENT ON COLUMN public.profiles.firebase_uid     IS 'Firebase Auth UID. NULL until the profile is claimed.';
COMMENT ON COLUMN public.profiles.claim_token      IS 'Single-use invite token (32+ chars hex). NULL after claim or revoke.';
COMMENT ON COLUMN public.profiles.claim_expires_at IS 'Invite expiration; ignored when claim_token is NULL.';
COMMENT ON COLUMN public.profiles.claimed_at       IS 'Set when student first signs in via the invite.';
COMMENT ON COLUMN public.profiles.created_by       IS 'Trainer profile.id that created this shadow row.';
