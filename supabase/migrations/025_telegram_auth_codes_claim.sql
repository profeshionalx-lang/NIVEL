-- Invite-flow via Telegram login: the auth code can carry the shadow-profile
-- id from an invite (claim) link, so the webhook binds Telegram to the
-- trainer-created profile instead of auto-creating a new one.
alter table telegram_auth_codes
  add column if not exists claim_profile_id uuid references profiles(id);
