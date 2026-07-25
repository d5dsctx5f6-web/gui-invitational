-- Brief 17 Part A: tee time slotting per matchup. A single timestamp covers both "what time"
-- and "what order" (sort ascending) -- no separate ordering column needed. Nullable: most
-- matches won't have one set until Chris assigns it in /admin, and nothing downstream should
-- break for a match with no tee time (scorecard header, duo submissions deadline, and /schedule
-- all treat null as "not yet assigned" and degrade gracefully).

alter table matches add column if not exists tee_time timestamptz;
