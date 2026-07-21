-- Seasons: every other table that needs a season FKs here (champions wall, annual franchise).

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  year int not null unique,
  name text not null
);

alter table seasons enable row level security;

create policy "anon can read seasons"
  on seasons for select
  to anon
  using (true);

insert into seasons (year, name) values (2027, 'Year One');
