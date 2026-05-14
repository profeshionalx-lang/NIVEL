-- Adds an explicit ordering column for insight cards so trainers can reorder them.
alter table public.insight_cards
  add column if not exists position integer not null default 0;

-- Backfill existing rows: number them per session by creation time.
with ordered as (
  select id, row_number() over (partition by session_id order by created_at) as rn
  from public.insight_cards
)
update public.insight_cards c
set position = o.rn
from ordered o
where o.id = c.id;
