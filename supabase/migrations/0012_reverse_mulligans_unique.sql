-- Brief 6 Part A.1: nothing currently stops a team from recording two reverse-mulligan
-- events in one round. One per team per round, per PRODUCT_SPEC §2.

alter table reverse_mulligans
  add constraint reverse_mulligans_one_per_team_round unique (team_id, round_id);
