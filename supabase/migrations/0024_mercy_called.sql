-- Brief 29: the mercy rule (quadruple bogey cap). A third do-over-style flag on hole_scores,
-- following the exact pattern of breakfast_ball/mulligan (0007) — no per-round usage limit
-- unlike those two, so no unique/count constraint needed, just the flag itself. The existing
-- row-level write policies (0014) already cover any column on hole_scores, so no RLS change
-- is needed here.

alter table hole_scores add column if not exists mercy_called bool not null default false;
