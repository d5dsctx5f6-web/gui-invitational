# PWA white-screen report — diagnosis + fix · Session Addendum

**Date:** August 26, 2026

**Report:** the installed PWA showed a white screen when opened from the home-screen icon.

## Diagnosis, in the order requested

**1. Console error on load.** Loaded the deployed production URL
(`gui-invitational.vercel.app`) fresh in a real browser tab and read the console: no error, one
benign warning (`_next/static/chunks/...css` preloaded but unused within a few seconds — a
Next.js font/CSS preload timing warning, unrelated). **This confirms the app works fine in a
regular browser tab** — I could not reproduce the white screen there, on production, just now.
I cannot access the console of your actual *installed* PWA session on your phone from here —
that needs Safari's remote Web Inspector (iPhone plugged into a Mac, Safari → Develop → your
device → the installed app) or `chrome://inspect` for Android. If it recurs, that console is the
one piece of direct evidence I don't have and can't fabricate.

**2. `manifest.json` validity + icon paths.** Valid JSON (parsed clean). All three icon files
`scripts/generate-icons.ts` wrote in Brief 30 — `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png` — exist, are valid PNGs at the correct declared dimensions (192×192,
512×512, 180×180), and all return `200 OK` with `content-type: image/png` when fetched directly
from production. Nothing missing or broken here.

**3. `start_url` / `scope`.** `start_url: "/"`, no explicit `scope` (defaults to `/`, the
manifest's own directory) — both resolve to the real, working home route. Unchanged by Brief 30;
`git log` on `manifest.json` shows only `name`/`short_name` changed, nothing structural.

**4. Service worker.** **None exists.** Grepped the entire codebase and full git history for
`serviceWorker`, `sw.js`, `workbox`, `next-pwa` — zero matches, and no service-worker file has
ever been committed to this repo. There is nothing here that registers a service worker, so
nothing here is capable of serving a stale cached shell via the Cache API. This mechanism is
structurally ruled out — not because I checked and found it healthy, but because it doesn't
exist to check.

**5. Root cause.** Everything server-/build-side that Brief 30 touched — manifest, icons,
favicon links, fonts — checks out clean on both the local build and the live production
deployment. What I *did* find, reading the app itself rather than guessing: **this app has never
had a Next.js error boundary anywhere** (`app/error.tsx`, `app/global-error.tsx`) — confirmed by
searching for both filenames across the whole `app/` tree, zero results, pre-dating Brief 30 by
the entire life of the project. That's a real, verified structural gap, not a hypothesis: it
means **any** unhandled client-side render error, from any cause, has always resulted in React
unmounting the tree with nothing left on screen — a silent, blank, unrecoverable white page, by
React/Next's own default behavior.

My leading hypothesis for *what actually threw* — labeled as a hypothesis, since I can't confirm
it without your device's own console — is the well-documented cross-deploy PWA pattern: an
installed home-screen app that was already open (backgrounded/suspended, not force-quit) since
before this deploy landed can get resumed by the OS from memory rather than doing a fresh page
load; if anything in that resumed session then tries to fetch a JS chunk from the *previous*
build (Vercel's static chunk filenames are content-hashed and rotate on every deploy), that
throws — and with no error boundary anywhere, it renders blank instead of showing anything.
I verified `/`'s HTML document itself is served `cache-control: private, no-cache, no-store,
must-revalidate` (confirmed via production's actual response headers) — so a stale cached HTML
document isn't the mechanism; a suspended in-memory session skipping the HTTP request entirely
is more consistent with what I found.

**A cheap test would confirm or rule this out directly**: remove the home-screen icon and
re-add it (or at minimum force-quit the installed app from the app switcher before reopening it).
If that resolves it, the hypothesis above is confirmed and there was nothing to fix beyond what's
below. If it recurs even after a completely fresh install, that's a different, still-unidentified
bug, and I'd want the actual on-device console error at that point to chase it further.

## Fix

Added the error boundary this app has never had, regardless of which trigger caused this
specific incident — it's the right structural fix either way, since it turns *any* future
unhandled render error into a recoverable "Something went wrong — tap to reload" screen instead
of a silent white one:

- `app/error.tsx` + `app/error.module.css` — catches errors in any route segment below the root
  layout (i.e. any page). Styled with the app's existing spruce/gold/cream tokens from
  `globals.css`, matching the current live aesthetic (not Brief 30's new token system — that
  system isn't wired into any live screen yet).
- `app/global-error.tsx` — catches the rarer case of an error in the root layout itself. Per
  Next's own requirement, this one renders its own `<html>`/`<body>` (it fully replaces the root
  layout while active), so it's deliberately self-contained with inline styles only — no
  dependency on `globals.css` or the layout's fonts, so it renders no matter what else is broken.

Both call `reset()` on their button, Next's built-in retry that re-renders the failed segment
without a full page reload first.

## Verification

- `npm run lint` / `npm run build` / `npm test` — all clean, 97/97 unchanged (no engine touched).
- **Actually triggered the failure mode to confirm the fix works**, rather than just trusting
  the Next.js docs: built a temporary `app/qa-error-boundary/page.tsx` that unconditionally
  throws on render (same disposable-QA-route pattern this project has used since Brief 12),
  loaded it against the local dev server, and confirmed `app/error.tsx` caught it and rendered
  the "Something went wrong — Try again" screen correctly, styled on-brand — not a white screen.
  Deleted the QA route immediately after; `git status --short` confirms no trace.
- **Re-ran Brief 30's own gate afterward**, since this fix touches `app/` broadly: `/` and
  `/rulebook` re-screenshotted and confirmed pixel-identical to before this fix (only the
  earlier rename text differs from pre-Brief-30, as expected). `/design-preview` re-checked and
  still renders every token/component correctly in dark mode, with its toggle state still
  persisted from Brief 30's own verification session. No existing live screen changed.

## Open item

The cheap confirming test above (force-quit + reopen, or remove + re-add the home-screen icon)
is the next step — please try it and let me know whether the white screen recurs. If it does,
get me the actual console error from the installed session via remote debugging if you can; that
would let me chase the specific trigger instead of the general-case fix above.
