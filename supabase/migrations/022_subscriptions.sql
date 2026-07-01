-- 022_subscriptions.sql
-- Абонементы ученика: купленный пак из N тренировок.
-- Списаний как операций нет — остаток вычисляется по истории сессий
-- (см. src/lib/dashboard/data.ts). Активный абонемент = последний по started_at.

create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.profiles(id) on delete cascade,
  total_sessions integer not null check (total_sessions > 0),
  started_at     timestamptz not null default now(),
  note           text,
  created_at     timestamptz not null default now()
);

-- Быстрый выбор активного (последнего) абонемента ученика.
create index if not exists subscriptions_student_started_idx
  on public.subscriptions (student_id, started_at desc);
