-- Brief 33 Part A (block 2 of 5): RLS. Fixes the Part 0 bug (signed-in devices use the
-- `authenticated` role and read ZERO rows from the v2 tables, and get no realtime events) and
-- adds write policies. Run after 0028. Idempotent.
--
-- Writes: scores and reverse-mulligan calls need can_score_duo(duo_id) -- the device's player is
-- in the match. UPDATE has both USING and WITH CHECK so a row can't be moved to a duo outside the
-- player's match. DELETE has no policy at all, i.e. service-role only (commissioner undo).
-- `duos` writes stay service-role only (no write policy).

begin;

-- Reads for signed-in devices, alongside the existing anon ones.
drop policy if exists "authenticated can read duos" on duos;
create policy "authenticated can read duos" on duos for select to authenticated using (true);

drop policy if exists "authenticated can read hole_scores" on hole_scores;
create policy "authenticated can read hole_scores" on hole_scores for select to authenticated using (true);

drop policy if exists "authenticated can read reverse_mulligans" on reverse_mulligans;
create policy "authenticated can read reverse_mulligans" on reverse_mulligans for select to authenticated using (true);

drop policy if exists "anon can read player_hole_scores" on player_hole_scores;
create policy "anon can read player_hole_scores" on player_hole_scores for select to anon using (true);

drop policy if exists "authenticated can read player_hole_scores" on player_hole_scores;
create policy "authenticated can read player_hole_scores" on player_hole_scores for select to authenticated using (true);

-- hole_scores (scramble)
drop policy if exists "match players can insert hole_scores" on hole_scores;
create policy "match players can insert hole_scores" on hole_scores for insert to authenticated
  with check (can_score_duo(duo_id));

drop policy if exists "match players can update hole_scores" on hole_scores;
create policy "match players can update hole_scores" on hole_scores for update to authenticated
  using (can_score_duo(duo_id)) with check (can_score_duo(duo_id));

-- player_hole_scores (best ball)
drop policy if exists "match players can insert player_hole_scores" on player_hole_scores;
create policy "match players can insert player_hole_scores" on player_hole_scores for insert to authenticated
  with check (can_score_duo(duo_id));

drop policy if exists "match players can update player_hole_scores" on player_hole_scores;
create policy "match players can update player_hole_scores" on player_hole_scores for update to authenticated
  using (can_score_duo(duo_id)) with check (can_score_duo(duo_id));

-- reverse_mulligans: any of the four can log either duo's call; unique (duo_id, round_id) already
-- enforces one per duo per round.
drop policy if exists "match players can log reverse mulligans" on reverse_mulligans;
create policy "match players can log reverse mulligans" on reverse_mulligans for insert to authenticated
  with check (can_score_duo(duo_id));

-- Verification: expect 4 SELECT policies for authenticated (duos, hole_scores, reverse_mulligans,
-- player_hole_scores), 3 INSERT policies and 2 UPDATE policies, and NO delete policy anywhere.
select
  (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('duos','hole_scores','reverse_mulligans','player_hole_scores')
    and cmd = 'SELECT' and roles @> '{authenticated}') as authenticated_select,
  (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('hole_scores','reverse_mulligans','player_hole_scores') and cmd = 'INSERT') as inserts,
  (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('hole_scores','player_hole_scores') and cmd = 'UPDATE') as updates,
  (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('duos','hole_scores','reverse_mulligans','player_hole_scores')
    and cmd in ('DELETE','ALL')) as delete_or_all_policies;

commit;
