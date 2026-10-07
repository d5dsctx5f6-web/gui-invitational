# Pressure-Test Protocol (standing, Brief 34 onward)

Every brief that changes scoring, standings, permissions, realtime or data visibility ends with this
protocol. A brief says only: **"run the pressure-test protocol for this brief's scope."** Claude Code
attacks its own work from the terminal, reports a pass/fail table with evidence, **fixes and re-runs
anything that fails, and never leaves a failure as "noted."** The human's phone/TV check afterwards is
about look-and-feel only; the logic is proven here.

**Hard limits.** QA scope only: never read-modify-write the real (2027) season. Writes go through the
**same RLS path the phones use** (anonymous session linked to a QA player); the service role is for
seeding/resetting the QA season, linking QA devices, and reading counts for verification only. Never
print, log or commit a key. Reset QA afterwards and prove it clean.

## F1 — Mutation testing (`npx tsx scripts/pressure-test/mutate.ts`)

Break one rule at a time, confirm the test suite fails, restore, and prove the file is byte-identical
again. **A mutation that survives is a missing test: add it before continuing** (the script exits
non-zero). The list lives in the script; extend it with every new rule. Standing mutations:

points tally (halve counts as 1) · possible points hardcoded · tiebreak order (holes before points) ·
chip-off auto-resolving / never flagged · shortened event counting the partial round · projection mixed
into official points · mercy cap removed · engine comparison flipped · perspective tile flipped · viewer
side inverted · QA scope filter removed · points-to-win off by half · clinch claimed while a round is
unpaired · recorded chip-off winner ignored · round "complete" with only some matches decided ·
projection of an up segment · the chip-off guard always allowing.

*Precedent:* the first run of this protocol found a survivor (tiebreak order). The suite had never
pinned a case where the points leader has fewer holes won; a search found real ones and they are now
tests.

## F2 — Live end-to-end against the real database (`npx tsx scripts/pressure-test/live.ts`)

1. **Scenarios.** Load every scenario (both Round-2 formats). For each, the live rows read through RLS and
   run through the engine must equal the hand-pinned result, **and** the rendered pages (fetched with a
   minted admin cookie for QA scope) must show the pinned score and wording.
2. **Permission attacks — each must be denied, with the database error captured:** a player writes to
   another match · to a duo outside his match / another season · a signed-out device writes · a player
   deletes a score · a second reverse mulligan for the same duo and round (even from the other duo's
   player) · a player changes a locked round's format (and the service role is blocked by the trigger) ·
   a player moves a score outside his match · a player edits/creates duos · a player forges the Cup flags.
   Where the live target can't exist without writing to the real season (a literal real-season duo), the
   same rule is proven on a synthetic real season in the migration replay (in-memory Postgres).
3. **Concurrency.** Two sessions post the same hole at the same moment (half the trials in opposite row
   order to provoke lock trouble): every outcome must be **one writer's complete pair**, never a mix; both
   clients must read back exactly what was stored. Measure realtime delivery to a third subscribed session
   over 20 posts: report median and worst; every post must arrive.
4. **Isolation.** The real season has 0 duos, 0 scores of either kind, 0 mulligans; no QA player on a real
   team; the default pages show no QA data; `?scope=qa` without a valid session, a **forged** admin cookie
   and an **expired** one all show no QA data; a direct QA match URL without a session shows nothing.
5. **Reset.** Reset QA and prove it clean (no scores, no mulligans, flags cleared, QA device links removed).

## F3 — Report

A pass/fail table for every F1–F2 item with evidence (counts, error text, timings). After deploying, also
run the checks that need no passcode against **production**: the default pages load, show no QA data, and
pick up a realtime change (`BASE_URL=https://… npx tsx scripts/pressure-test/live.ts --no-admin-pages`,
plus a live browser check that a QA write makes the production board refetch).
