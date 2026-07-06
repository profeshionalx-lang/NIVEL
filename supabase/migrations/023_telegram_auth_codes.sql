-- Telegram-based login: one-time auth codes exchanged via /start login_<code>
create table if not exists telegram_auth_codes (
  code text primary key,
  telegram_chat_id bigint,
  profile_id uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'consumed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz
);

create index if not exists telegram_auth_codes_expires_at_idx
  on telegram_auth_codes (expires_at);
