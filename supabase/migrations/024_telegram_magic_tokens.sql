-- One-time magic-link tokens for auto-login from Telegram notifications.
create table if not exists telegram_magic_tokens (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  next_path text not null default '/dashboard',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists telegram_magic_tokens_profile_idx
  on telegram_magic_tokens (profile_id);
