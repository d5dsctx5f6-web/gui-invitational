# BRIEF 30 — DESIGN SYSTEM FOUNDATION (LIGHT + DARK, NORTH/SOUTH HEDGES)

**Project:** The Hedges Invitational app · **Type:** new foundation brief, precedes the v2.0 format migration · **Issued:** Aug 26, 2026
**Execute in:** Claude Code on Chris's personal MacBook
**Depends on:** current live app (M3 + hardening pass); `PRODUCT_SPEC_V2.md` and `GUI_INVITATIONAL_RULEBOOK_V2.md` (architect-issued — supersede all prior spec/rulebook versions); `hedges-tokens.css`, `logo/` SVG assets, and the approved mockup `Hedges Invitational.dc.html` (all architect-delivered, all superseding this brief's originally-provisional Parts B, C, and F — see superseded notes inline)
**Gate:** a `/design-preview` route (dev-only, not linked from nav) renders every token and every core primitive component in both light and dark mode, toggle persists across reload, North Hedges blue and South Hedges gold render correctly, and nothing on the existing live screens regresses — because this brief touches zero existing screens.

---

## Context (read once)

Two things are landing at once: a full competition-format rewrite (v1.0 → v2.0 — two teams, scramble match play, live Pairings Night) and a full visual reset (the current board/tile mockup aesthetic → modern broadcast/SaaS, light and dark both). Nearly every screen the format migration touches is a screen that would also need restyling. Doing the reset first, as its own foundation, means the five migration briefs that follow (schema/engine, Pairings Night board, scorecard + Cup leaderboard, ledger presets, rulebook copy) build their UI **once**, against a settled system — not once for function and again for style.

**This brief is infrastructure only.** It does not restyle `/scorecard`, `/duos`, `/money`, `/admin`, or anything else currently live. It builds the tokens and the primitive component library, proves them on an isolated preview route, and stops. The v2.0 migration briefs consume this system as they rebuild each screen for the new format — restyling and rebuilding happen together, screen by screen, starting with Brief 31.

**Also folded in here, because it's cheap now and expensive later:** the event rename. "The GUI Invitational" is retired; the app is now **The Hedges Invitational**. Per the architect's note in `PRODUCT_SPEC_V2.md` §Open Items — centralize the display name as a single config constant before any more screens hardcode the old one.

Grounding: `PRODUCT_SPEC_V2.md` (canonical), `GUI_INVITATIONAL_RULEBOOK_V2.md`, `ARCHITECTURE.md` (confirm actual current styling approach in the live codebase — plain CSS, CSS modules, or Tailwind — before assuming; diagnose first, this brief's implementation should follow whatever's already there unless told otherwise).

---

## Scope — Part A: Rename to config

- Add a single source of truth for the event name — e.g. `lib/config.ts` exporting `EVENT_NAME = "The Hedges Invitational"`, `TEAM_NAMES = { north: "North Hedges", south: "South Hedges" }`.
- Grep the codebase for hardcoded "GUI Invitational" occurrences (masthead, page titles, PWA manifest `name`/`short_name`, admin panel, any seed/fixture data) and report the list — do not silently mass-replace without listing what was found, since some may be intentionally historical (e.g., a champions-wall Year 1 record if any test data exists).
- Do not rename the Vercel project slug or repo in this brief — that's a deployment/domain change with its own blast radius; flag it as a follow-up item instead of doing it inline.

## Scope — Part B: Color tokens (light + dark) — LOCKED, not provisional

**Superseded note:** this section originally proposed provisional values pending mockup approval. The mockup is approved. Use the exact values below — pulled from `hedges-tokens.css` (architect-delivered alongside this brief) — not fresh proposals.

- Import `hedges-tokens.css` wholesale as the token source, or port its `[data-theme="light"]` / `[data-theme="dark"]` custom properties into `tailwind.config` — do not re-derive these values from scratch.
- **North Hedges:** `--n #00205B` (light) / `#2C5EB0` (dark — brightened for dark-surface contrast; South's gold needs no equivalent adjustment).
- **South Hedges:** `--s #B9975B`, same value both themes.
- Full semantic set (live/win/loss/halve, each with an `-ink` and `-soft` variant) and full neutral surface/text/border scale for both themes are all defined in `hedges-tokens.css` — bring the file in directly.

## Scope — Part C: Typography — LOCKED

**Superseded note:** also no longer provisional. Confirmed pairing: `--font-ui` = Inter, `--font-display` = Barlow Condensed (scores, hole numbers, match state, headings). Both already load correctly via Google Fonts in the approved mockup; swap to self-hosted or `next/font` in the real build for performance, but keep the same two families.

## Scope — Part D: Spacing, radius, elevation, motion

- Spacing scale (4px or 8px base — pick one, apply everywhere).
- Radius scale — modern broadcast/SaaS reads cleaner with a tighter, more consistent radius than the current tile system's ad-hoc values.
- Elevation: dark mode should lean on borders/subtle background-shift rather than drop shadows, which read muddy on dark surfaces; light mode can use soft shadows. Both as tokens, not per-component judgment calls.
- Motion tokens: a couple of duration/easing pairs (fast for taps/toggles, slower for state transitions like a live score update landing) — reused everywhere rather than every component inventing its own transition.

## Scope — Part E: Core primitive components

Build once, as the shared vocabulary every later screen composes from. Each must render correctly in both themes on the preview route:

- **Button** (primary, secondary, ghost, destructive states)
- **Card / surface container**
- **Chip / badge** (for match state, "live," tags like drives-used)
- **Stat tile** (the board/leaderboard building block — replaces the old `.tile` system)
- **Match state pill** (the win/halve/live indicator used across scorecard and leaderboard)
- **Stepper control** (score entry +/−, already exists functionally — rebuild visually on the new tokens)
- **Tab bar / nav**
- **Theme toggle** itself — light/dark/system, persisted client-side (localStorage is sufficient; no schema change needed for a display preference)

Do not wire these into any existing screen yet. That's Briefs 31–35, one screen at a time, alongside each screen's functional rebuild.

## Scope — Part F: Logo/mark — DELIVERED, not placeholder

**Superseded note:** the mark is done. Four SVG files are architect-delivered alongside this brief (`logo/mark-color.svg`, `mark-color-dark-bg.svg`, `mark-mono-dark.svg`, `mark-mono-light.svg`) — twin-tower silhouette, North's bar in blue, South's in gold, two unequal-height rectangles, no windows or detail so it holds at favicon size. Wire these into the masthead lockup, favicon, PWA manifest icons (all required sizes — generate from `mark-color.svg`), and apple-touch-icon. No placeholder monogram needed.

## Scope — Part G: Reference implementation exists — use it, don't re-derive it

The approved mockup (`Hedges Invitational.dc.html`, in Claude Design's own preview format) is the working reference for every component in Part E — Cup leaderboard, Pairings Night board, scorecard, match detail, Challenge Ledger with presets, Drives Used, schedule, champions wall, rules. Its inline styles and interaction logic (mercy-cap detection, hole-strip win/loss/halve rendering, Pairings Night reveal sequencing) are the intended behavior — port the patterns into real components rather than reinterpreting the brief from scratch.

**Do not use the `_ds/Modernist` folder bundled in the same export.** It's an unused, mismatched template (mono red accent, single Archivo font, zero radius, no dark mode) that the actual mockup ignores entirely. If using `/design-sync`, point it at the mockup file and `hedges-tokens.css`, never at `_ds/`.

---

## Verification

1. `/design-preview` shows every token category (colors, type scale, spacing, radius, motion) and every Part E component, in both themes, toggled live with no reload required.
2. Confirm North Hedges blue and South Hedges gold render correctly against both the light and dark neutral scales — check contrast, not just presence.
3. Toggle preference persists across a reload and across a fresh tab.
4. Grep confirms zero remaining hardcoded "GUI Invitational" strings outside of explicitly-flagged historical/seed data.
5. Existing live screens (`/scorecard`, `/duos`, `/money`, `/admin`, etc.) are visually and functionally unchanged — this brief must not regress anything, since it doesn't touch them.
6. Report back: what styling approach the codebase actually uses (confirm/correct the Tailwind assumption), and the final chosen font pairing if adjusted during implementation.

## Close-out

Session addendum (shipped / commits / deviations / open issues — especially the styling-approach confirmation and any font substitution) to the Desktop project folder and `/docs`. Update `PROJECT_STATUS.md`.

## Next

Brief 31 (schema/engine migration) can now be scoped directly — no further design work blocks it. Bring the mockup, `hedges-tokens.css`, and the `logo/` assets into the repo before starting Part E component work.
