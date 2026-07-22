-- Brief 7 Part A: realtime foundation. Supabase Realtime only streams postgres_changes for
-- tables explicitly added to the supabase_realtime publication — RLS still applies on top
-- (a subscriber only receives rows it could otherwise SELECT). These are exactly the tables
-- that change live during a round.

alter publication supabase_realtime add table hole_scores;
alter publication supabase_realtime add table reverse_mulligans;
alter publication supabase_realtime add table duo_submissions;
alter publication supabase_realtime add table skins_entries;
alter publication supabase_realtime add table challenge_bets;
