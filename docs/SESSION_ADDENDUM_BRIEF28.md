# Brief 28 — Rulebook Content Expansion · Session Addendum

**Date:** July 27, 2026

**Shipped:** a pure content replacement on `/rulebook`. Pushed to `main`.

## What changed

Replaced all nine section bodies in `app/rulebook/page.tsx` with Brief 28's expanded copy —
same nine headers, same collapsible structure Brief 25 built and Brief 27 restyled, just more
explanation per section: concrete worked examples (the Cup section now walks through a real
2-up-front/split-back/whatever-18 scenario to show a single match can hand points to both sides),
and — the one genuinely new piece of information — both tiebreaker ladders spelled out in full
for the first time.

## The tiebreaker correction, finally landed correctly

Brief 25's original copy tried to cover this in one sentence and got it wrong (implied one ladder
covered the Cup, Sunday's pairings, and the individual title alike); the Part C accuracy pass had
to strip the claim rather than ship it false. This brief's copy states both ladders explicitly:
Cup/pairings use points → head-to-head → holes won; the individual title uses cumulative net →
Sunday net → Sunday back-9 net — both bottoming out in a chip-off. Cross-checked against
`PRODUCT_SPEC_ADDENDUM_A.md` §3 one more time before shipping, per the brief's own instruction
(same discipline as Brief 25's Part C) — this time it's accurate, verbatim from the brief, no
edits needed.

## Verification

- `npm run lint` — clean.
- `npm run build` — clean, all 9 routes, no TypeScript errors.
- `npm test` — **97/97**, unchanged (pure content change, no engine involvement).
- **Live-verified on a real 375×812 mobile viewport**: expanded "How the Cup gets won" (now five
  paragraphs including the worked example) and "Money" sections both render cleanly using Brief
  27's shared type scale — no overflow, no cramped wrapping, multi-paragraph sections read
  comfortably one-handed.

## Out of scope, confirmed untouched

The engine, the collapsible section mechanism itself, every other screen, and the internal
`GUI_INVITATIONAL_RULEBOOK.md`/`PRODUCT_SPEC_ADDENDUM_A.md` docs (read for cross-checking only).

## Open items carried forward

Unchanged from Brief 27's addendum.

## Next

Brief 29 (the mercy rule) is queued immediately after this in the same session — it adds a new
tenth section to this same screen, landing as its own separate commit on top of this one.
