# Brief 30 — Design System Foundation (Light + Dark, North/South Hedges) · Session Addendum

**Date:** August 26, 2026

**Shipped:** the event rename to config, an isolated `/design-preview` route proving every
color/type/spacing/radius/motion token and every Part E primitive component in both themes,
and the architect-delivered logo mark wired into favicons/PWA icons. Touches zero existing
live screen beyond the rename text itself. Pushed to `main`.

## Styling-approach confirmation (per the brief's own Part A instruction)

Diagnosed before writing any token code, per the brief's explicit request: this codebase uses
**CSS Modules** (one `*.module.css` per route/component) plus a single global `app/globals.css`
for shared tokens — **not Tailwind**. `package.json` has no `tailwind`/`postcss` dependency at
all. `hedges-tokens.css` was ported as a plain CSS custom-properties file, not a Tailwind config,
and every Part E component follows the existing CSS Modules convention already used throughout
`/score`, `/admin`, `/money`, etc.

## Part A — rename to config

New `lib/config.ts`: `EVENT_NAME = "The Hedges Invitational"`, `EVENT_SHORT_NAME`, and
`TEAM_NAMES = { north: "North Hedges", south: "South Hedges" }` (not consumed anywhere yet —
the live app is still v1.0's four-team format; this constant exists for Brief 31's schema/engine
migration to reach for instead of hardcoding it fresh).

**Grep results, reported before touching anything** (per the brief's "report, don't silently
mass-replace" instruction):
- Live code, renamed to read from `EVENT_NAME`: `app/layout.tsx` (metadata title/description),
  `app/page.tsx` and `app/champions/page.tsx` (masthead text), `public/manifest.json`
  (`name`/`short_name` — a static JSON file, so these are hand-kept in sync with `lib/config.ts`
  rather than importing it; flagging this as a minor accepted duplication, not a defect).
- Also renamed, judged as live-but-secondary rather than historical: `scripts/audit-m2-trip.ts`'s
  console banner, and `README.md`'s title line.
- **Left untouched, flagged as intentionally historical**: every numbered `docs/BRIEF_*.md` file,
  `docs/PROJECT_STATUS.md`/`PROJECT_STATUS.md`'s existing entries, `docs/PRODUCT_SPEC.md` (v1),
  `docs/GUI_INVITATIONAL_RULEBOOK.md` (v1), `docs/ARCHITECTURE.md`, `docs/BUILD_PLAN.md`,
  `docs/PROJECT_OPERATIONS.md`, `docs/TESTING AND HARDENING.md` — these are point-in-time
  records of what was true when issued/built; rewriting them under the new name would falsify
  the project's own history. `PRODUCT_SPEC_V2.md`/`GUI_INVITATIONAL_RULEBOOK_V2.md` already use
  the new name throughout, as delivered.
- Vercel project slug/repo name: not touched, per the brief's own explicit instruction — flagged
  as a follow-up deployment/domain decision, not done inline.

## Part B/C — color + typography tokens — ported, not re-derived

`hedges-tokens.css` copied verbatim (with provenance comments) into
`app/design-preview/hedges-tokens.css`, plus a pristine, untouched reference copy at
`design/hedges-tokens.css`. Confirmed against your stated check before writing anything:
North Hedges `#00205B` (light) / `#2C5EB0` (dark), South Hedges `#B9975B` (both themes), Inter +
Barlow Condensed (not one font for everything), and `[data-theme="dark"]` is a real, independently
authored block — not an inverted light theme. All four matched; nothing needed to stop for.

Fonts loaded via `next/font/google` (Inter, Barlow Condensed) in `app/design-preview/layout.tsx`
— a **nested** layout, not the root layout, so both the fonts and `hedges-tokens.css` are scoped
to the `/design-preview` route segment by Next's own per-segment CSS/font bundling and never
ship to any other route.

## Part D — spacing/radius/elevation/motion (not locked — my own derivation)

Not marked locked in the brief, unlike B/C/F, so these are my own scale rather than a port:
4px-base spacing (`--space-1`…`--space-8`), a 6-step radius scale (`--radius-xs` 3px through
`--radius-full`), and named motion tokens (`--duration-fast`/`--duration-base`/`--duration-slow`/
`--duration-pulse`, `--ease-snap`/`--ease-standard`) plus the mockup's own four `@keyframes`
(hedgeFlash/hedgeDrop/hedgePulse/hedgePop, previously only comments in the delivered token file,
now real CSS). The radius scale specifically matches the actual pixel values used throughout the
approved mockup's inline styles (3/4/5/6/8/12px) rather than an arbitrary invented scale.

## Part E — primitive components

Button (primary/secondary/ghost/destructive), Card (with an optional north/south team-color top
edge), Chip (neutral/live/win/loss/halve/north/south, with an optional pulsing dot), Stat tile,
Match state pill (north-up/south-up/all-square/live), Stepper (76px tap targets, matching the
mockup's score-entry buttons), Tab bar, and the Theme toggle itself — all in
`app/design-preview/components/`, each a `.tsx` + `.module.css` pair following the codebase's
existing component convention. None are wired into any existing screen — that's Briefs 31–35.

**Theme toggle implementation note**: built on `useSyncExternalStore` reading `localStorage` +
`matchMedia('(prefers-color-scheme: dark)')`, not `useState`+`useEffect` — this repo's ESLint
config (`eslint-plugin-react-hooks` 7.1.1) enforces `react-hooks/set-state-in-effect` as a hard
error, which the more obvious mount-guard/`useEffect` pattern trips. `useSyncExternalStore` is
also the React-recommended fix for exactly this "read external mutable state, safe across
server/client" case, so this isn't a workaround, it's the correct primitive for the job.
Preference persists to `localStorage` under `hedges-theme-preference`.

## Part F — logo/mark — wired, with one caveat

All four delivered SVGs copied into `public/icons/` (functional copies) and `design/logo/`
(pristine, untouched reference copies of exactly what was delivered). `scripts/generate-icons.ts`
(new, reusable — not a throwaway) rasterizes `mark-color.svg` into `icon-192.png`, `icon-512.png`,
and an opaque-white-backed `apple-touch-icon.png` (iOS renders transparent PNG icons with a black
fill, so the apple variant needs a real background square) using `sharp` — added as a devDependency
since it's only available as an undeclared transitive dep of `next`'s image optimizer, which is
too fragile to reach into directly. `app/layout.tsx`'s `metadata.icons` now lists the SVG favicon
first (modern browsers render it directly) with PNG fallbacks; `public/manifest.json`'s icon
entries point at the regenerated PNGs.

**Real bug found and fixed in the delivered asset**: `mark-color-dark-bg.svg`'s own comment —
`<!-- ... brightened to --n dark-mode value -->` — contains a literal `--` inside an XML/SVG
comment, which is illegal per the XML spec (comments may not contain `--` anywhere except as
the delimiters). Chrome's strict SVG-as-image decoder silently refused to render the whole file
as an `<img>`/`<Image>` source because of it, even though it fetched fine as raw text with the
correct `image/svg+xml` content-type — caught during live verification, confirmed by loading the
raw file directly and reading the browser's own parse-error page. Fixed by rewording the comment
in the `public/icons/` working copy only; `design/logo/mark-color-dark-bg.svg` is left as
originally delivered, for provenance. **Flagging for you to fix at the source** if this mark gets
regenerated or re-delivered later.

**Deviation, disclosed rather than silently decided**: the brief says to wire the mark into "the
masthead lockup" on top of favicon/manifest/apple-touch-icon. Favicon/manifest/apple-touch-icon
are meta-level assets (browser tab, home-screen icon) — swapping them doesn't change how any
screen looks or behaves, so I did those directly. The actual home-page/`/champions` masthead
JSX (`<h1>THE HEDGES INVITATIONAL</h1>`, plain text, no logo image) I left exactly as Part A's
rename produced it — inserting the SVG mark there would be a visual change to a live screen,
which the brief's own gate says this brief must not do ("nothing on existing live screens
regresses — because this brief touches zero existing screens"). Instead, the masthead-with-logo
lockup is demonstrated as a component inside `/design-preview` itself (top-left of the preview
page). **Confirm this reading is what you intended** — if you actually want the real home page
masthead carrying the logo now, that's a one-line follow-up, just flag it.

## Part G — reference implementation

`design/HEDGES_MOCKUP_APPROVED.dc.html` brought into the repo verbatim as the reference every
Part E component was checked against (radius values, chip/button/card inline styles, the
`hedgeDrop`/`hedgePulse` keyframes). Never touched `_ds/Modernist` — it wasn't part of what you
handed me, so there was nothing to avoid pointing at.

## Verification

- `npm run lint` — clean (after fixing the `react-hooks/set-state-in-effect` error above and
  switching two `<img>` tags to `next/image`).
- `npm run build` — clean, all 11 routes including `/design-preview`, which builds as a fully
  **static** route (○) — it needs no server data at all, an extra confirmation of how isolated it
  is from the rest of the app.
- `npm test` — **97/97**, unchanged (this brief touches zero engine code).
- **Live-verified in a real browser against the dev server**:
  - `/design-preview` in dark mode (System, resolved dark) and light mode (explicit Light) —
    every color swatch, the type scale, spacing/radius scale, the motion demo, and every Part E
    component all render correctly in both themes, confirmed via screenshots.
  - North Hedges blue and South Hedges gold checked for real contrast against both neutral
    scales, not just presence — confirmed legible in both themes per the swatch grid.
  - Toggle set to Light, then a full page reload — preference held. Then opened a **second,
    independent browser tab** cold to `/design-preview` — it loaded already in Light, confirming
    cross-session persistence via `localStorage`, not just in-memory state.
  - Existing live screens re-checked after all changes: `/` (home) renders with the exact
    original spruce/gold/Oswald aesthetic, only the masthead text and footer error copy
    changed by the rename — no token bleed. `/rulebook` (all 10 sections, including Brief 29's
    "Calling mercy") renders unchanged. Neither route loaded any of `/design-preview`'s CSS or
    fonts (confirmed via network request inspection), proving Next's per-route-segment CSS/font
    scoping actually holds, not just "should hold in theory."
  - Note: the home page's "connection failed: TypeError: fetch failed" footer is the existing
    Supabase read failing from this sandboxed dev-server environment (no route to the real
    Supabase host from here) — pre-existing to this session's network setup, not a regression;
    unrelated to anything this brief touched (Brief 30 never touches data fetching).

## Deviations from the brief, summarized

1. Favicon/manifest/apple-touch-icon updated as part of Part F; the actual masthead JSX on
   `/`/`/champions` was **not** given the logo image, only the renamed text — see Part F above,
   flagged for your confirmation.
2. Added `sharp` as a new devDependency (for icon generation) — not previously a project
   dependency, direct or transitive-and-relied-on. `scripts/generate-icons.ts` is the only place
   that imports it; rerun it any time the mark SVGs change instead of hand-exporting PNGs.
3. Found and fixed a genuine XML-comment defect in the delivered `mark-color-dark-bg.svg` (see
   Part F) — the working copy in `public/icons/` is fixed, the reference copy in `design/logo/`
   is left as delivered.

## Out of scope, confirmed untouched

`/scorecard` (i.e. `/score`), `/duos`, `/money`, `/admin`, `/leaderboard`, `/schedule` — no
visual or functional change beyond nothing (none of these were touched at all). The engine:
zero changes. `TEAM_NAMES` in `lib/config.ts`: defined, not consumed anywhere yet.

## Pre-existing, unrelated — flagged, not fixed

`npm audit` reports 6 high-severity advisories, all pre-existing and transitive via the pinned
`next@16.2.10` (a `postcss` XSS/path-traversal chain and a `sharp`/`libvips` CVE chain) — fixing
either requires an unrelated `next` version bump (`npm audit fix --force` wants `next@16.3.3`),
well outside a design-system brief's scope. Flagging for a dedicated dependency-bump brief.

## Open items carried forward

Unchanged from Brief 29's addendum, plus: confirm the masthead-lockup reading above; the
`npm audit` items just above; and Brief 31 (schema/engine migration) is now unblocked — no
further design work gates it, per the brief's own "Next" section.

## Next

Brief 31 (schema/engine migration) can proceed directly, consuming `TEAM_NAMES` and the token/
component system built here.
