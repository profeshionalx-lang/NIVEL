-- Telegram chat linkage per profile.
create table if not exists telegram_links (
  profile_id uuid primary key references profiles(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint,
  username text,
  linked_at timestamptz not null default now(),
  is_active boolean not null default true
);

create unique index if not exists telegram_links_chat_id_uniq
  on telegram_links (telegram_chat_id)
  where is_active = true;

-- One-time tokens for /start <token> deep-link flow.
create table if not exists telegram_link_tokens (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists telegram_link_tokens_profile_idx
  on telegram_link_tokens (profile_id);
