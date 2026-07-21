# GUI INVITATIONAL — PROJECT OPERATIONS

**Read this first.** This document defines how the build project works. v1.1

---

## Suggested project instructions (paste into this project's custom instructions)

> This project exists to design and build the GUI Invitational app — a live-scoring golf trip app for 16 players, March 26–28, 2027. Chris is the owner, commissioner, and builder. Claude acts as architect: planning, writing numbered Claude Code briefs, reviewing session results, and maintaining the grounding docs. Ground every answer in project knowledge (PRODUCT_SPEC is canonical for the build; GUI_INVITATIONAL_RULEBOOK for trip rules; ARCHITECTURE for technical decisions; BUILD_PLAN for milestones and status). Claude Code executes all code on Chris's personal MacBook. Greg (Chris's autonomous agent, separate project) is not involved by default — considered only case-by-case where a task genuinely needs an autonomous agent or would clearly benefit his development; never in the product or the build loop. Be direct, recommend concretely, keep briefs self-contained.

---

## 1. What this project is

The design and build home for the **GUI Invitational app**. This is a separate effort from the Greg project — different machine (Chris's personal MacBook), different repo, different project knowledge. Greg-project conventions that work (numbered briefs, session addendums, versioned docs) carry over; Greg himself does not.

## 2. Roles

| Who | Role |
|---|---|
| **Chris** | Owner, commissioner, builder. Makes all product decisions. Runs Claude Code sessions. |
| **Claude.ai (this project)** | Architect. Plans, writes briefs, reviews outcomes, resolves open spec items with Chris, keeps docs current. |
| **Claude Code** | Builder. Executes numbered briefs on Chris's MacBook. All code goes through it. |
| **Greg** | **Not involved by default.** Considered case-by-case, at Chris's call, only where (a) a task genuinely needs an autonomous agent, or (b) it's a clear development opportunity for Greg. Never in the product, never in the build loop. |

## 3. Document map

| Doc | Answers | Canonical for |
|---|---|---|
| PROJECT_OPERATIONS.md | How we work | Workflow & roles |
| PRODUCT_SPEC.md | What we're building | **The build** — features, rules-as-logic, constraints |
| GUI_INVITATIONAL_RULEBOOK.md | How the trip runs | **The trip** — the human-facing rules |
| ARCHITECTURE.md | How it's built | Stack, data model, engine principles |
| BUILD_PLAN.md | When and in what order | Milestones, status, pending inputs |

Spec and Rulebook derive from the same decisions; if they ever diverge, flag it and reconcile — the Spec governs code, the Rulebook governs conduct.

## 4. Workflow

1. **Architect session** (here): decide, spec, then produce a numbered brief — `Brief 1`, `Brief 2`, … — self-contained, with context, exact scope, and verification steps.
2. **Build session** (Claude Code): execute the brief. Commit early and often.
3. **Addendum**: after each build session, capture a short session record (what shipped, commits, deviations, open issues) and upload it to project knowledge.
4. **Doc updates**: any decision that changes spec, rules, architecture, or plan gets versioned into the relevant doc(s) — in project knowledge *and* the repo (`/docs`).

Milestone gates are physical: **a milestone is done when it survives Chris's thumbs on a real phone**, never when it's described as done.

## 5. Key decisions & rationale (so we never relitigate)

| Decision | Why |
|---|---|
| Chris builds, not Greg | Capability mismatch: Greg's polished systems were all Chris + Claude Code builds; his autonomous-build record (the lab) shows silent failure modes. This app fails in public on one unmovable weekend. Greg is out by default — case-by-case only, per the roles table. |
| Next.js + TS + Supabase + Vercel, PWA | Realtime + Postgres managed for $0; deepest Claude Code fluency; link-tap install honors the 30-second rule. |
| No self-hosting on Greg's machine | $0 vs $0 — self-hosting saves nothing and makes an aging, sleep-prone laptop the single point of failure during the only weekend that matters. Backups and uptime run on standard free tooling (ARCHITECTURE §7). |
| Raw events stored, everything derived | Corrections become trivial, engine becomes pure and testable. Never persist standings. |
| No feed / photos | Group chat owns the vibes; the app owns the truth. Cut the most built-and-abandoned feature class. |
| Gross skins, opt-in | Easy + maximum reward; outright-win + carryovers keep everyone live; fairness already lives in the net cup and individual race. |
| Points race over bracket | 2 rounds + no seeding history: brackets eliminate half the field after day 1. Earned day-2 pairings give a final without eliminations. |
| No AI at runtime | The shipped app is standalone software. Zero model calls, zero Greg dependencies. |
