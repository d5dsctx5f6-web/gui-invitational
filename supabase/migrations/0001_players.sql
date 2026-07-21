-- M0: players table + read-only public access + locked 16-man roster.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  index numeric null
);

alter table players enable row level security;

create policy "anon can read players"
  on players for select
  to anon
  using (true);

insert into players (name) values
  ('Chris Deliso'),
  ('CJ Lambrecht'),
  ('Spencer Petersen'),
  ('Will Petersen'),
  ('Matt Lacko'),
  ('Zac Jones'),
  ('Matt Hornbecker'),
  ('Andrew Sabia'),
  ('Brendan Gleason'),
  ('Ian Hastings'),
  ('Ben Meier'),
  ('Tucker Gill'),
  ('Cam Delaney'),
  ('Dominic Ikeler'),
  ('Grant Brogan'),
  ('Rory Makohin');
