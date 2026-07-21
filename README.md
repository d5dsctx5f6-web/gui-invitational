# The GUI Invitational

Live-scoring PWA for a 16-man golf trip, March 26–28, 2027.

Next.js + TypeScript (App Router) → Supabase (Postgres + Realtime) → Vercel.

## Structure

- `/app` — the Next.js app.
- `/engine` — pure TypeScript scoring engine. No framework imports, ever.
- `/docs` — grounding docs (spec, architecture, rulebook, build plan, ops), mirrored from project knowledge.
- `/supabase/migrations` — SQL migrations, committed and run manually via the Supabase SQL editor.

## Local dev

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev
```

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — eslint
- `npm run test` — vitest (engine tests)
