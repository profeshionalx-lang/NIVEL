create table if not exists master_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles(id) on delete cascade,
  trainer_id uuid not null references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(student_id)
);

create table if not exists master_plan_sections (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references master_plans(id) on delete cascade,
  title text not null,
  category text not null check (category in ('strength','technique','tactics','custom')),
  sort_order int not null default 0
);

create table if not exists master_plan_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references master_plan_sections(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  sort_order int not null default 0
);
