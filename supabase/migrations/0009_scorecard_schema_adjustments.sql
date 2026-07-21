-- Two adjustments discovered building the M1 scorecard (Brief 3):
--
-- 1. course_tees needs per-hole par and (optional) yardage so the scorecard can display
--    real hole detail — net math itself never needed par, this is a display-only addition.
-- 2. duo_submissions.duo_b_player_1 relaxed to nullable: a team down to exactly two
--    available players fields only one duo that round. Count-agnostic, per ARCHITECTURE's
--    own principle from Brief 2 — this just applies it one notch further (a team can have
--    zero duo-B players, not only a short duo-B).

alter table course_tees
  add column par_by_hole int[],
  add column yardage_by_hole int[],
  add constraint course_tees_par_by_hole_length
    check (par_by_hole is null or array_length(par_by_hole, 1) = 18),
  add constraint course_tees_yardage_by_hole_length
    check (yardage_by_hole is null or array_length(yardage_by_hole, 1) = 18);

alter table duo_submissions
  alter column duo_b_player_1 drop not null;
