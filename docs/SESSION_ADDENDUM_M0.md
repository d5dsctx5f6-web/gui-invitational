# M0 — Scaffold · Session Addendum

**Date:** July 20, 2026

**Shipped:** M0 complete and verified. Next.js + TypeScript PWA shell; Supabase project (`players` table with anon-select RLS policy, 16-man roster seeded); Vercel production deploy live at https://gui-invitational.vercel.app; `/engine` module stubbed with Vitest passing; all six grounding docs mirrored in `/docs`.

**Commits:** through `2515090`.

**Gate met:** production URL opens on phone, all 16 names render live from Supabase, "connection live" footer confirms the DB fetch, Add-to-Home-Screen installs standalone, live-rename test passed (edit in Supabase → reload → change appears).

## Deviations / things to remember

- Roster seeded in two passes — 9 rows landed from the migration, topped up to 16 via a follow-up SQL insert; a `players_name_unique` constraint was added to guard against duplicate names.
- Scroll fix: `html, body { height: 100% }` was pinning body to a fixed viewport height and the flex child got shrink-clipped; changed to `min-height: 100vh` so the page scrolls natively (commit `2515090`).
- GitHub auth is via SSH (ed25519 key on this MacBook); no `gh` CLI or Homebrew installed. Pushes use the SSH remote.
- `.env.local` holds the Supabase URL + anon key locally; both env vars also set in Vercel for Production + Preview.

## Open items (none blocking M1)

- `players.index` column intentionally NULL until handicaps are collected trip-week.
- Courses, tees, and skins buy-in still pending (per SPEC §6).

## Next

Brief 2 — data model buildout (courses, rounds, teams, matches, hole_scores) + scoring engine skeleton with first tests.
