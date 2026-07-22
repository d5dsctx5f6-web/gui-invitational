# Brief 6 — M3 Part 1: Auth Foundation + Admin Panel · Session Addendum

**Date:** July 22, 2026

**Shipped:** All engineering for M3 Part 1, pushed to `main`.

- **Part A (carried-forward items closed):** `reverse_mulligans` now has `unique(team_id, round_id)`. The M1-era interim anon-write policy on `hole_scores` is dropped, replaced in the same migration pass with an identity-scoped policy (no gap where the table was unwritable).
- **Part B (player identity):** no accounts, no email. A player taps their name and sets/verifies a 4-digit PIN. Under the hood this rides on Supabase Auth anonymous sign-in (one real `auth.uid()` per device) linked to a `player_id` via `player_devices` — so RLS is genuinely identity-aware, not faked in application code. PIN hashes live in `player_auth`, reachable only through two `SECURITY DEFINER` RPCs (`set_player_pin`, `verify_and_link_pin`); the hash is never selectable directly.
- **Part C (RLS):** `hole_scores` writes now require a signed-in (authenticated + linked) player. Interim scoping decision, explicitly allowed by the brief: any signed-in player can write any `hole_scores` row (not scoped to exact round assignment) — a scorekeeper often enters for the whole foursome. Documented in the migration and in `supabase/README.md`. `SELECT` stays anon-open everywhere, unchanged since M0.
- **Part D (admin panel):** passcode-gated `/admin` (HMAC-signed session cookie, ~8hr expiry, required every session). All admin writes go through Server Actions using the service-role client, bypassing RLS after a `requireAdmin()` check in every action. Covers Teams (create/edit, captain, count-agnostic member add/remove), Rounds & Matchups, Handicap Indexes, Course Setups (18-value arrays for stroke index/par/yardage, stroke index validated as a true 1-18 permutation), and Corrections — the key capability: editing a `hole_scores` row directly, with `revalidatePath` hitting both `/admin` and `/score` so the fix is visible immediately, no redeploy.
- **Infrastructure:** replaced the single anon-key `getSupabase()` with proper `@supabase/ssr` clients (`lib/supabase/{client,server,admin}.ts`) so the session cookie is shared between Server Components and the browser. `middleware.ts` had to be renamed to `proxy.ts` mid-brief — Next.js 16 deprecated the old convention (exported function renamed `middleware` → `proxy` too).

**Bug caught and fixed before close:** after the first round of live verification, the `/score` "not signed in" fallback showed a message with only a "← Back to sign in" link pointing at `/`. If that page's picker was ever unreachable for any reason (a slow deploy propagation — my best guess for what was actually observed, since re-checking production immediately after showed the roster rendering correctly with no console errors — or any other transient hiccup), there was no other way in: a genuine dead end. Fixed by giving `IdentityPicker` a `redirectTo` prop and embedding it directly on `/score`'s signed-out state, so signing in lands you back on the scorecard you came for, not just the homepage. This removes the dead-end risk regardless of what caused the original symptom.

**Commits:** `956bc6c` (docs) → `b998d12` (migrations) → `d1b2833` (identity + SSR clients) → `c1ed0ab` (admin panel) → `092268c` (dead-end fix).

## What was intentionally kept simple (friends-trip threat model, not a bank)

- **PIN hijack:** nothing stops someone from tapping a teammate's name before that teammate does and claiming it (first-to-set-a-PIN wins; `set_player_pin` just refuses to *overwrite* an existing PIN). No out-of-band verification (email, phone) exists to prevent this. Acceptable for 16 known friends; would not be acceptable at any larger or less-trusted scale.
- **No PIN lockout/rate-limiting:** wrong PIN just says "try again," indefinitely. Fine for casual mis-taps, not a real auth system.
- **`hole_scores` write scope:** any signed-in player can correct any player's score, not just their own foursome's. Explicitly the brief's own permitted interim; tightening to exact round-assignment is flagged as a Brief 7 follow-up once duo submissions are live.
- **Admin passcode:** a single shared secret, no per-admin accounts (there's only one admin). The HMAC-signed cookie is a reasonable stateless mechanism for this, not a general-purpose session system.
- **Admin device usage:** commissioner authority is not restricted to Chris's specific hardware — same passcode, any device.

## Still pending — the actual M3-Part-1 gate

All code is shipped, but **the verification in Brief 6's own gate has not run yet.** Before it can:

1. Chris runs migrations `0012`, `0013`, `0014` in the Supabase SQL editor (in that order — `0013` must land before `0014`).
2. Chris enables **Anonymous sign-ins** in the Supabase dashboard (Authentication → Sign In / Providers) — required for the PIN flow; can't be done via SQL migration.
3. Chris adds two new server-only env vars — `SUPABASE_SERVICE_ROLE_KEY` (from Project Settings → API) and `ADMIN_PASSCODE` (his own choice) — to `.env.local` and to Vercel (Production + Preview), then redeploys.
4. Live verification, together: sign in as a real player on a phone, confirm recognition survives a reload; unlock `/admin`, edit a team/index/matchup, and — the key one — correct a `hole_scores` row and confirm the scorecard reflects it live.

## Open items

None new. Carried forward from Brief 5: ARCHITECTURE §5 reconciliation still pending.

## Next

Finish the M3-Part-1 live gate above, then **Brief 7 (M3 Part 2)**: realtime subscriptions, blind duo submission UI + simultaneous reveal, skins opt-in toggle, the Challenge Ledger UI, and the reverse-mulligan calling UI in the scorekeeper flow.
