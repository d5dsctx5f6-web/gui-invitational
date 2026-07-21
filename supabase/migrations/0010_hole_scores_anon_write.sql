-- Interim, pre-auth write access for the scorekeeper flow (Brief 3 / M1).
--
-- ARCHITECTURE's plan is that writes arrive with the auth model in M3 (PINs). But M1's whole
-- point is a scorekeeper entering real scores from an unauthenticated phone, so hole_scores
-- needs an open write path now. Deliberately scoped to this one table — every other table
-- stays anon-read-only. Anyone with the (public, client-embedded) anon key can currently post
-- scores; the threat model is "friends with a link," not the general internet, and this must
-- be revisited when PINs land in M3.

create policy "anon can insert hole_scores (pre-auth interim, see migration comment)"
  on hole_scores for insert
  to anon
  with check (true);

create policy "anon can update hole_scores (pre-auth interim, see migration comment)"
  on hole_scores for update
  to anon
  using (true)
  with check (true);
