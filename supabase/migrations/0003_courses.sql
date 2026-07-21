-- Courses + per-tee setup. A course can carry multiple tee sets; rounds and players
-- can each point at a different tee (per-player mixed tees, per ARCHITECTURE §5 / PRODUCT_SPEC §2).

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

alter table courses enable row level security;

create policy "anon can read courses"
  on courses for select
  to anon
  using (true);

create table if not exists course_tees (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  tee_name text not null,
  rating numeric not null,
  slope int not null,
  par int not null,
  stroke_index int[] not null,
  constraint course_tees_stroke_index_length check (array_length(stroke_index, 1) = 18),
  unique (course_id, tee_name)
);

alter table course_tees enable row level security;

create policy "anon can read course_tees"
  on course_tees for select
  to anon
  using (true);
