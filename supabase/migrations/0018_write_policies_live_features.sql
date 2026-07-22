-- Brief 7: write policies for the four tables that had SELECT-only policies since M0
-- (0008 stub_tables) and have never had a write path. Unlike hole_scores (Brief 6, loosely
-- scoped to "any signed-in player" since a scorekeeper enters for a whole foursome), these
-- are each scoped to the specific player(s) the action actually belongs to — duo picks are a
-- captain's call, a skins entry is a player's own opt-in, a challenge bet only involves its
-- two named parties.

-- ---------------------------------------------------------------------------
-- reverse_mulligans — only a member of the calling team can log a call.
-- The reverse_mulligans_one_per_team_round unique constraint (0012) is the backstop against
-- double-calling; the app surfaces a clean error on that race rather than a raw DB message.
-- ---------------------------------------------------------------------------

create policy "a team member can call their team's reverse mulligan"
  on reverse_mulligans for insert
  to authenticated
  with check (
    exists (
      select 1
      from player_devices pd
      join team_members tm on tm.player_id = pd.player_id
      where pd.auth_user_id = auth.uid()
        and tm.team_id = reverse_mulligans.team_id
    )
  );

-- ---------------------------------------------------------------------------
-- duo_submissions — only the team's actual captain (teams.captain_player_id) can write its
-- row, and only as themselves. Upsert-friendly (captains may revise before the deadline).
-- ---------------------------------------------------------------------------

create policy "a team's captain can submit their duo picks"
  on duo_submissions for insert
  to authenticated
  with check (
    exists (
      select 1
      from player_devices pd
      join teams t on t.captain_player_id = pd.player_id
      where pd.auth_user_id = auth.uid()
        and t.id = duo_submissions.team_id
        and pd.player_id = duo_submissions.captain_player_id
    )
  );

create policy "a team's captain can revise their duo picks"
  on duo_submissions for update
  to authenticated
  using (
    exists (
      select 1
      from player_devices pd
      join teams t on t.captain_player_id = pd.player_id
      where pd.auth_user_id = auth.uid()
        and t.id = duo_submissions.team_id
    )
  )
  with check (
    exists (
      select 1
      from player_devices pd
      join teams t on t.captain_player_id = pd.player_id
      where pd.auth_user_id = auth.uid()
        and t.id = duo_submissions.team_id
        and pd.player_id = duo_submissions.captain_player_id
    )
  );

-- ---------------------------------------------------------------------------
-- skins_entries — a player can only opt themselves in/out. Toggle = insert to opt in,
-- delete to opt out; the existing unique(player_id, round_id) makes double opt-in a no-op
-- error the UI just treats as "already in."
-- ---------------------------------------------------------------------------

create policy "a signed-in player can opt themselves into skins"
  on skins_entries for insert
  to authenticated
  with check (
    exists (
      select 1 from player_devices pd
      where pd.auth_user_id = auth.uid() and pd.player_id = skins_entries.player_id
    )
  );

create policy "a signed-in player can opt themselves out of skins"
  on skins_entries for delete
  to authenticated
  using (
    exists (
      select 1 from player_devices pd
      where pd.auth_user_id = auth.uid() and pd.player_id = skins_entries.player_id
    )
  );

-- ---------------------------------------------------------------------------
-- challenge_bets — anyone signed in can propose (naming themselves as proposer); only the
-- two named parties can subsequently touch the row (accept, settle). Dispute/void/reassign
-- is an admin-only power exercised through the service-role client, not RLS.
-- ---------------------------------------------------------------------------

create policy "a signed-in player can propose a challenge bet"
  on challenge_bets for insert
  to authenticated
  with check (
    exists (
      select 1 from player_devices pd
      where pd.auth_user_id = auth.uid() and pd.player_id = challenge_bets.proposer_id
    )
  );

create policy "the two named parties can update their challenge bet"
  on challenge_bets for update
  to authenticated
  using (
    exists (
      select 1 from player_devices pd
      where pd.auth_user_id = auth.uid()
        and pd.player_id in (challenge_bets.proposer_id, challenge_bets.acceptor_id)
    )
  )
  with check (
    exists (
      select 1 from player_devices pd
      where pd.auth_user_id = auth.uid()
        and pd.player_id in (challenge_bets.proposer_id, challenge_bets.acceptor_id)
    )
  );
