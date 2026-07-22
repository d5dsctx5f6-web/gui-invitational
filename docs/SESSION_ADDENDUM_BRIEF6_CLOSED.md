# Brief 6 — M3 Part 1: Auth Foundation + Admin Panel · CLOSED

**Date:** July 22, 2026

**Status:** Verified live, end to end, on Chris's phone. This closes the gate that
`SESSION_ADDENDUM_BRIEF6.md` left pending.

## What was verified live

- **PIN sign-in works and persists.** A player picks their name, sets a 4-digit PIN, and the
  device stays recognized across a reload — the anonymous-auth-device-link model (`player_auth`
  / `player_devices`, migration `0013`) works as designed.
- **The admin passcode gate works.** `/admin` is reachable, the HMAC-signed session cookie holds
  for the session.
- **The key capability proved live, not just in tests:** a live score correction and a mulligan
  toggle, both made in `/admin`, correctly rippled through to the scorecard in real time on
  Chris's phone with no redeploy — the "store raw, derive everything" architecture principle
  holding up under an actual live edit, which is the entire point of the Corrections feature.

## Two bugs, caught and fixed mid-session — part of Brief 6's own story

Both surfaced during this same live-verification pass, not as separate incidents. Brief 6 isn't
"done" until both are folded into its history, since the feature wasn't actually usable until
they were fixed.

**1. The sign-in flow was broken end to end.** First report: the roster was missing from the
home page, and `/score`'s "sign in first" message was a dead end — its only link pointed back
at `/`, with no guarantee that page's picker was reachable. Two separate defects turned out to
be stacked on top of each other:

- `/score`'s signed-out fallback had no real way in — just a link to `/`. Fixed by giving
  `IdentityPicker` a `redirectTo` prop and embedding it directly on `/score` itself, so signing
  in lands you back on the scorecard you came for (commit `092268c`).
- The actual reason the roster was disappearing at all: every `SELECT` policy in the schema,
  going back to M0, was scoped `to anon` only. Brief 6's eager anonymous sign-in (`IdentityPicker`'s
  `useEffect`, firing on every page load before a name is even picked) gives a device an
  `authenticated`-role JWT almost immediately — and from that point on, every read from that
  device was silently evaluated against `authenticated`-role policies that didn't exist. RLS
  denial and "no rows" look identical over PostgREST, so nothing errored — the roster, and
  every other table, just rendered empty. Fixed by migration `0015`, widening all 14 existing
  read policies to `anon, authenticated` (commit `d5a2882`).

**2. PIN-setting failed with `function gen_salt(unknown) does not exist`.** `0013` installed
`pgcrypto` with no explicit schema, which lands in `extensions` on Supabase by convention, not
`public`. `set_player_pin()` and `verify_and_link_pin()` are `SECURITY DEFINER` with
`set search_path = public`, which excluded wherever `pgcrypto` actually landed — `crypt()`/
`gen_salt()` weren't visible inside either function. Fixed by migration `0016`, which looks up
`pgcrypto`'s real schema via `pg_extension` at runtime (rather than hardcoding a guess) and
widens both functions' `search_path` to include it (commit `1535863`).

Net effect: Brief 6 shipped code-complete, but the feature wasn't actually usable until three
follow-up commits (`092268c`, `d5a2882`, `1535863`) landed during live verification. All three
are now in `main` and confirmed working.

## Open item — minor, not blocking

**`/admin` isn't directly addable to the home screen as its own icon.** The PWA manifest
(`public/manifest.json`) has a single `start_url: "/"` and no `scope` override. "Add to Home
Screen" always installs against `start_url`, regardless of which page you were on when you
triggered it — so an icon added from `/admin` still opens to `/` on launch, not straight to
`/admin`. Getting a dedicated admin icon would need a second manifest scoped to `/admin` with
its own `start_url`. Cosmetic — `/admin` is still one tap away from the home screen icon — and
deferred, not blocking anything. Fix whenever it's convenient.

## Brief 6 / M3 Part 1: fully closed

All of Part A (carried-forward migration items), Part B (player identity), Part C (RLS), and
Part D (admin panel) are shipped, verified live, and stable. See `SESSION_ADDENDUM_BRIEF6.md`
for the original shipped-work writeup this addendum closes out.

## Next

**Brief 7 (M3 Part 2):** realtime subscriptions for multi-device live sync, blind duo submission
UI with simultaneous reveal, the skins opt-in toggle, the Challenge Ledger UI, and the
reverse-mulligan calling UI in the scorekeeper flow.
