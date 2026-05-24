alter table sessions add column if not exists reminder_sent_at timestamptz;

create index if not exists sessions_reminder_lookup_idx
  on sessions (scheduled_at)
  where status = 'planned' and reminder_sent_at is null;
