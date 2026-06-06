-- FCM device tokens for native push notifications.
-- One row per (user, platform). Token updated on each FCM onNewToken.
create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  updated_at timestamptz default now(),
  unique (user_id, platform)
);

create index if not exists device_tokens_user_id_idx on device_tokens (user_id);
