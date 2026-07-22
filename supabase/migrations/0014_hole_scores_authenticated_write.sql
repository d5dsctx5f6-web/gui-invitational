-- Brief 6 Part A.2 + Part C: replaces the M1-era interim anon-write policy on hole_scores
-- with an identity-scoped one, in the same pass so the table is never left unwritable.
--
-- Interim scoping decision (explicitly allowed by Brief 6 Part C): a scorekeeper often
-- enters for the whole foursome, not just their own ball, and exactly expressing "this
-- player is assigned to this round via duo_submissions/matches" in RLS is more machinery
-- than this milestone needs. So: any authenticated player (linked via player_devices,
-- i.e. has picked a name and entered a PIN) can write any hole_scores row — but writes
-- must be tied to a real signed-in identity, never anonymous. Tightening this to
-- exact-round-assignment is a reasonable follow-up once duo submissions are live (Brief 7).

drop policy "anon can insert hole_scores (pre-auth interim, see migration comment)" on hole_scores;
drop policy "anon can update hole_scores (pre-auth interim, see migration comment)" on hole_scores;

create policy "a signed-in player can insert hole_scores"
  on hole_scores for insert
  to authenticated
  with check (
    exists (select 1 from player_devices where auth_user_id = auth.uid())
  );

create policy "a signed-in player can update hole_scores"
  on hole_scores for update
  to authenticated
  using (
    exists (select 1 from player_devices where auth_user_id = auth.uid())
  )
  with check (
    exists (select 1 from player_devices where auth_user_id = auth.uid())
  );
