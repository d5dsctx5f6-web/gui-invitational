# Brief 19 — Gross-Sorted Individual Race Toggle · Session Addendum

**Date:** July 26, 2026

**Shipped:** a display-only feature, no engine changes. Pushed to `main`.

## What changed

`/leaderboard`'s Individual Race gained a "Net / Gross" segmented toggle, styled with the same
`.tabs`/`.tab`/`.tabActive` classes already used for the Cup/Individual Race toggle so it reads as
the same UI language, nested one level in.

- **Default on load: Net** — identical order to what Brief 16/18 already produced. Unchanged.
- **Gross**: re-sorts the *same* standings list by gross-to-par ascending. Both the net-to-par
  (`.pts` tile) and gross-to-par (`nameDetail` line) columns stay visible in both states — per the
  brief, only order changes, not what's displayed.

## Why no engine changes were needed

Brief 16 already computes `cumulativeGross` and `parPlayed` on every `IndividualStanding`,
always-present (default 0), independent of `cumulativeNet`. Gross-to-par
(`cumulativeGross - parPlayed`) is exactly as stable and sortable as net-to-par already is — no
diagnostic finding to report here, the brief's own contingency (Scope item 5) didn't apply.

The sort itself lives entirely in `LeaderboardScreen.tsx`:

```ts
const sortedStandings = useMemo(() => {
  if (raceSort === "net") return race.standings;
  return [...race.standings].sort(
    (a, b) => a.cumulativeGross - a.parPlayed - (b.cumulativeGross - b.parPlayed),
  );
}, [race.standings, raceSort]);
```

`race.standings` itself (the engine's net-sorted output) is untouched — Net mode just returns it
directly, Gross mode copies and re-sorts client-side.

## Tie handling under gross sort (Brief's Scope item 4)

Checked rather than assumed, per the brief's own caution. What "tie/chip-off surfacing logic"
actually means for the Individual Race (distinct from the Cup's `rankTeams()`
`chipOffRequired`/`T{rank}` bucketing, which is a team-only concept) is narrower: the engine's own
net sort **leaves equal values equal** — `computeIndividualRace()`'s docstring is explicit about
this ("no tie-breaking here"). There's no forced arbitrary distinct rank injected anywhere.

The new gross sort uses a plain numeric comparator with no tiebreaker added — the same honesty
rule, just applied to a different field. Two players tied on gross-to-par stay tied (identical
displayed values, adjacent rows, stable relative order from the underlying `Map` iteration order,
same as today's net tie behavior). Nothing about the position number (`i + 1`, a plain list
position — the Individual Race doesn't do the Cup's `T{rank}` bucketing, and this brief didn't ask
me to add it) changes between sort modes; whatever honesty guarantee existed for net carries over
identically to gross, because it's the same sort function shape, not new logic per field.

The ◆ daily-low-net badge is unaffected by the toggle in either direction — it's a fixed
net-based achievement (`race.dailyLows`, always net), not something that should flip meaning
depending on which column the list happens to be sorted by.

## Toggle survives realtime refetch (Brief's Scope item 6)

`raceSort` is its own `useState`, separate from `snapshot`. `refetch()` (fired by the three
`useRealtimeRefetch` subscriptions on `hole_scores`/`duo_submissions`/`matches`) only calls
`setSnapshot(...)` — it never touches `raceSort`. React preserves all of a mounted component's
other state across a re-render triggered by one particular `useState` changing, so this can't
regress by construction. This is architecturally identical to how the pre-existing Cup/Individual
`view` toggle already survives the same refetch, unchanged since Brief 14.

Per the brief's own item 6, I did not perform a live production write to trigger this end-to-end
(admin-write testing is reserved for Chris on his own device, same standing rule as every prior
live-gate item) — the above is a structural guarantee, not a live-observed one, and is called out
here rather than left implicit.

## Verification

- `npm run lint` — clean.
- `npm test` — 90/90, unchanged count (no engine changes, exactly as the brief expected).
- `npm run build` — clean, all 8 routes.
- Live-verified against real production data on `/leaderboard`:
  - Net (default): Ben Meier −2, Matt Lacko −1, Grant Brogan +6, Chris Deliso +9 — same order as
    before this brief.
  - Toggled to Gross: re-sorted correctly by gross-to-par ascending — Chris Deliso (+31 gross),
    Matt Lacko (+33), Ben Meier (+35), Grant Brogan (+43) — net values (+9, −1, −2, +6) stayed
    visible in the same tile, unchanged, only row order moved.
  - Daily-low ◆ badges stayed attached to Matt Lacko and Ben Meier in both views (net-based,
    correctly indifferent to the toggle).
  - Toggled back to Net: exact original order returned.
  - No console errors in either state.

Only 4 players currently have posted scores in production (down from the fuller set seen during
Brief 18's session) — that's Chris's own live data changing between sessions, not a regression;
noted for context, not something this brief touched.

## Out of scope, confirmed untouched

Team Cup standings, the default view (still Cup-first / Net-first), and no new admin controls —
all per the brief's own scope boundary.

## Open items carried forward

Unchanged from Brief 18's addendum: migrations `0020`, `0021`, `0023` still need Chris to run
them (`0022` confirmed run); the resubmission-before-reveal assumption from Brief 13; Brief 7's
live two-device gate; Brief 9's own live gate; ARCHITECTURE §5.

## Next

Once Chris runs the three pending migrations, the database is fully caught up. M4 — the dress
rehearsal — remains the next real milestone.
