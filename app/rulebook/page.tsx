"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import styles from "./rulebook.module.css";

// Brief 25 — a player-facing hub explaining every game mechanism, written for guys who aren't
// especially golf-savvy. Purely static content: nothing here reads from the database, so this
// is a plain client component (needed only for the collapsible open/close state below) rather
// than a server component with a fetch. Distinct from the internal docs/GUI_INVITATIONAL_RULEBOOK.md
// (that's Chris's own architect-facing reference) — this is the copy for the other 15 guys.
//
// Copy is Brief 25 Part B, used verbatim except one accuracy fix: the tiebreakers section
// originally read "the automatic tiebreakers (points, head-to-head, holes won)" as if that one
// ladder covered the Cup, the individual title, and Sunday's pairings alike. It doesn't — per
// PRODUCT_SPEC_ADDENDUM_A.md §3, the individual title uses a different ladder entirely
// (cumulative net → better Sunday net → better Sunday back-9 net → chip-off), nothing to do with
// points/head-to-head/holes won. Dropped the inaccurate parenthetical rather than state something
// false; flagged in this session's addendum for Chris to see.

interface Section {
  key: string;
  title: string;
  body: ReactNode;
}

const SECTIONS: Section[] = [
  {
    key: "format",
    title: "The format",
    body: (
      <>
        <p>
          16 guys, 4 teams of 4, drafted by captains on trip night. Two rounds count: Saturday is
          a shamble, Sunday is four-ball. (There&apos;s also a Friday fun round — that one&apos;s
          just for fun, nothing on this app tracks it.)
        </p>
        <p>
          Each round, your team splits into two duos. Your duo plays another team&apos;s duo,
          head-to-head, match play. Four duo matches happening at once — that&apos;s four
          foursomes out on the course.
        </p>
      </>
    ),
  },
  {
    key: "cup",
    title: "How the Cup gets won",
    body: (
      <>
        <p>
          Every duo match is worth 3 points: 1 for the front nine, 1 for the back nine, 1 for the
          full 18. Win a segment, get the point. Halve it, split the point.
        </p>
        <p>
          12 points up for grabs each day, 24 for the whole weekend. Most points after Sunday wins
          the Cup.
        </p>
        <p>
          Sunday&apos;s matchups aren&apos;t random — they&apos;re earned. Whoever&apos;s 1st in
          the standings after Saturday plays whoever&apos;s 2nd. 3rd plays 4th. Win Saturday, you
          get a crack at 1st place Sunday.
        </p>
      </>
    ),
  },
  {
    key: "formats",
    title: "The formats, explained",
    body: (
      <>
        <p>
          <b>Shamble (Saturday):</b> everyone in the duo tees off, you pick the best drive, then
          everyone plays their own ball in from there. Best net score on the duo counts.
        </p>
        <p>
          <b>Four-ball (Sunday):</b> play your own ball the whole hole, start to finish. Best net
          score on the duo counts.
        </p>
      </>
    ),
  },
  {
    key: "handicaps",
    title: "Handicaps — you don't do any math",
    body: (
      <p>
        Real GHIN index if you&apos;ve got one, an assigned number if you don&apos;t. The app
        converts that into actual strokes for whatever course we&apos;re on that day, and shows
        you exactly which holes you get a stroke on. You never calculate anything — just play,
        the dots are already there.
      </p>
    ),
  },
  {
    key: "doovers",
    title: "Do-overs",
    body: (
      <p>
        Once a round: one breakfast ball (redo your very first tee shot only) and one mulligan
        (redo any other shot, except once you&apos;re on the green). Whatever you make after the
        do-over is your real score — it counts everywhere: the match, skins, your individual
        total.
      </p>
    ),
  },
  {
    key: "reverseMulligan",
    title: "The reverse mulligan — the team weapon",
    body: (
      <>
        <p>
          Once per team, per round. Either of your duos can use it — it&apos;s shared across the
          whole team, not one per duo.
        </p>
        <p>
          Here&apos;s how it works: your team can force an opponent to replay any one shot — a
          drive, an approach, even a putt. He hits it again and plays on from there. He
          doesn&apos;t play two balls.
        </p>
        <p>
          The twist: if the shot you&apos;re reversing was already in the hole, it still counts
          as made for that guy&apos;s own skins and individual race — even though your team&apos;s
          match sees the miss. Everything else, the replay is just the real, final score.
        </p>
        <p>Call it immediately, before the next shot — or it&apos;s gone.</p>
      </>
    ),
  },
  {
    key: "individualRace",
    title: "Individual race",
    body: (
      <p>
        Runs the whole weekend, separate from the team stuff. Lowest cumulative net across both
        rounds wins. Daily low net gets a nod too (no cash, just bragging rights).
      </p>
    ),
  },
  {
    key: "money",
    title: "Money — two things, that's it",
    body: (
      <>
        <p>
          <b>Skins:</b> opt in before your round&apos;s tee time (once you&apos;re in, you
          can&apos;t back out). Gross score, lowest score on a hole wins it outright — no strokes
          given. Tie for low? It carries to the next hole. If a round ends with skins still
          unclaimed, that pot doesn&apos;t disappear — it rolls forward into the next round.
        </p>
        <p>
          <b>The Challenge Ledger:</b> any bet, anytime, between any two guys. Log it in the app,
          the other guy taps to accept — that&apos;s what makes it official. Settle it when
          it&apos;s decided. Shows up in your running total.
        </p>
      </>
    ),
  },
  {
    key: "ties",
    title: "How ties get broken",
    body: (
      <p>
        Never in the app. If the automatic tiebreakers still leave it dead even — for the Cup,
        the individual title, or Sunday&apos;s pairings — it comes down to a chip-off. Grab a
        wedge.
      </p>
    ),
  },
];

export default function RulebookPage() {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Rulebook · <b>everything, explained like you&apos;re hearing it over beers</b>
      </div>

      <div className={styles.list}>
        {SECTIONS.map((section) => {
          const isOpen = openKeys.has(section.key);
          return (
            <div className={styles.section} key={section.key}>
              <button
                type="button"
                className={styles.toggle}
                onClick={() => toggle(section.key)}
                aria-expanded={isOpen}
              >
                <span className={styles.toggleTitle}>{section.title}</span>
                <span className={styles.chevron}>{isOpen ? "▴" : "▾"}</span>
              </button>
              {isOpen && <div className={styles.body}>{section.body}</div>}
            </div>
          );
        })}
      </div>
    </main>
  );
}
