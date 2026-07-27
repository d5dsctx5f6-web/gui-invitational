# Brief 19 — Gross-Sorted Individual Race Toggle

## Context

`/leaderboard`'s Individual Race was built in Brief 14 (The Cup + Individual Race, realtime-wired, honest tie/chip-off handling). Brief 16 fixed the race's formatting — it now shows net-to-par and gross-to-par side by side per player, sorted by net.

Chris confirmed (post-Brief 18) that side-by-side columns aren't the full ask: he wants a genuine gross-ranking view, not just a column next to the net one. Specifically: a toggle within the existing Individual Race section that re-sorts the same player list by gross-to-par instead of net-to-par.

## Scope

1. Locate the Individual Race component under `/leaderboard` (Brief 14, formatting updated Brief 16).
2. Add a toggle control (e.g. a "Net / Gross" segmented control) above the Individual Race list.
   - Default state on load: **Net** (current behavior, unchanged).
   - **Gross** state: re-sort the identical player list by gross-to-par ascending (best gross first).
3. Both columns (net-to-par and gross-to-par) stay visible in both toggle states — only the sort order changes, not what's displayed.
4. Reuse Brief 14's tie/chip-off surfacing logic under **both** sort orders. Ties in gross-to-par need the same honest handling as ties in net-to-par currently get — don't assume the net logic is order-agnostic without checking.
5. No engine/backend changes are expected — both metrics are already computed and rendered (Brief 16). This is display/sort logic only.
   - If gross-to-par turns out not to be a stable, independently sortable field as currently computed, **stop and report that as a diagnostic finding** rather than reworking engine output to force it.
6. Confirm the realtime subscription (Brief 14) doesn't reset the toggle to Net on every data refresh — a user sitting in Gross view should stay there across live updates.

## Out of scope

- Team Cup standings — untouched.
- Changing the default (net-first) view.
- Any new admin controls.

## Verification steps

1. `npm test` — confirm 90/90 still passes (no engine changes expected, so no new test count).
2. Manual: load `/leaderboard` fresh — confirm default is net-sorted, identical to today.
3. Manual: toggle to Gross — confirm re-order by gross-to-par ascending, and that any tied/chip-off players are surfaced honestly (not silently dropped or misordered).
4. Toggle back to Net — confirm original order returns exactly.
5. Trigger a live data change (e.g. an admin correction) while sitting in Gross view — confirm the list re-sorts correctly in place, doesn't snap back to Net.
6. Chris live-verifies against real production data on his own device — this is a read-only feature, no admin-write testing needed from Claude Code.

## End-of-session ritual (standard)

- Short addendum, saved to Chris's Desktop grounding-docs folder and the repo's `/docs`.
- `PROJECT_STATUS.md` updated.
- Commit and push.
