-- Brief 6 introduced Supabase Auth anonymous sign-in, eagerly established on every
-- page load (see IdentityPicker's useEffect). An anonymous session's JWT carries
-- role "authenticated" (not "anon") — so once a device has signed in anonymously,
-- every read it makes is evaluated against "authenticated"-role policies, and every
-- read policy in this schema was scoped `to anon` only. Result: as soon as a device
-- picked up its (invisible, automatic) anonymous session, every read query silently
-- returned zero rows — the roster, rounds, matches, everything — with no error,
-- since RLS denial looks identical to "no rows" over PostgREST.
--
-- These policies were always meant to be open reads (`using (true)`), not anon-only.
-- Widen each to also cover the authenticated role.

alter policy "anon can read players" on players to anon, authenticated;
alter policy "anon can read seasons" on seasons to anon, authenticated;
alter policy "anon can read courses" on courses to anon, authenticated;
alter policy "anon can read course_tees" on course_tees to anon, authenticated;
alter policy "anon can read rounds" on rounds to anon, authenticated;
alter policy "anon can read teams" on teams to anon, authenticated;
alter policy "anon can read team_members" on team_members to anon, authenticated;
alter policy "anon can read matches" on matches to anon, authenticated;
alter policy "anon can read duo_submissions" on duo_submissions to anon, authenticated;
alter policy "anon can read hole_scores" on hole_scores to anon, authenticated;
alter policy "anon can read reverse_mulligans" on reverse_mulligans to anon, authenticated;
alter policy "anon can read skins_entries" on skins_entries to anon, authenticated;
alter policy "anon can read challenge_bets" on challenge_bets to anon, authenticated;
alter policy "anon can read schedule_items" on schedule_items to anon, authenticated;
