-- Rounds: the two competitive rounds only. The Friday fun round is itinerary-only
-- (schedule_items) and never gets a row here — the engine never touches it.

create table if not exists rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons (id),
  date date not null,
  format text not null check (format in ('shamble', 'four_ball')),
  course_id uuid not null references courses (id),
  default_tee_id uuid references course_tees (id)
);

alter table rounds enable row level security;

create policy "anon can read rounds"
  on rounds for select
  to anon
  using (true);
