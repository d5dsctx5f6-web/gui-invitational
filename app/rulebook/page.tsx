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
// Brief 28 replaced Brief 25's original concise copy with a more descriptive, example-driven
// version — same nine section headers, same collapsible structure, just more explanation per
// section. Both tiebreaker ladders (Cup/pairings vs. individual title) are now spelled out in
// full for the first time, cross-checked against PRODUCT_SPEC_ADDENDUM_A.md §3 — Brief 25's
// original copy had wrongly implied one ladder covered all three cases and had to be stripped
// down rather than shipped wrong; this version states both correctly instead.

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
          16 guys, 4 teams of 4, drafted by captains on trip night before anyone hits a shot. Two
          rounds actually count for the Cup: Saturday is a shamble, Sunday is four-ball.
          (There&apos;s also a Friday fun round — that one&apos;s just for fun, nothing on this
          app tracks it, so play whatever you want.)
        </p>
        <p>
          Each round, your team splits into two duos — you and one teammate, playing as a pair.
          Your duo goes head-to-head against one duo from another team, straight match play:
          lowest score on the hole wins it, ties halve it. Four duo matches happen at once each
          round — that&apos;s four foursomes out on the course simultaneously, one from each
          teammate pairing.
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
          Every duo match is worth 3 points total, split into three separate mini-contests: the
          front nine (holes 1–9), the back nine (holes 10–18), and the full 18 (the whole match
          start to finish). You&apos;re not just racing to see who wins the round overall —
          you&apos;re fighting for each segment separately.
        </p>
        <p>Win a segment outright, you get that point. Get through it dead even, you split it — half a point each.</p>
        <p>
          For example: say your duo is 2-up after the front nine — that&apos;s your point, full
          stop, even if you come back to lose the back nine. Then if the back nine ends up split
          even, that&apos;s a half-point each. And however the full-18 tally lands, that&apos;s
          the third point. A single match can hand out points to both sides.
        </p>
        <p>
          12 points up for grabs each day (4 matches × 3 points), 24 for the whole weekend. Most
          points after Sunday wins the Cup — outright, every point matters.
        </p>
        <p>
          Sunday&apos;s matchups aren&apos;t random — they&apos;re earned. Whoever&apos;s 1st in
          the standings after Saturday plays whoever&apos;s 2nd. 3rd plays 4th. Win Saturday, and
          you&apos;re playing for 1st place Sunday, not just padding your own score.
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
          <b>Shamble (Saturday):</b> everyone in the duo tees off on every hole. You and your
          partner pick whichever drive is better, then both of you play your own ball in from
          there, all the way to the hole. It&apos;s chaos-friendly — one great drive can save the
          whole hole for your team. Best net score between the two of you counts for the duo.
        </p>
        <p>
          <b>Four-ball (Sunday):</b> no team tee shot, no picking the best drive — you play your
          own ball from tee to green the entire hole, exactly like a normal round. Best net score
          between you and your partner counts for the duo, same as Saturday, just with fully
          independent golf all the way through.
        </p>
      </>
    ),
  },
  {
    key: "handicaps",
    title: "Handicaps — you don't do any math",
    body: (
      <p>
        Real GHIN index if you&apos;ve got one, an assigned number if you don&apos;t — either way,
        everyone plays with a fair number. The app converts your index into actual strokes for
        whatever course and tees we&apos;re on that day, using the course&apos;s real rating and
        slope, and shows you exactly which holes you get a stroke on (the toughest holes on the
        card get the first strokes, easiest holes get the last ones, if you&apos;re getting enough
        to wrap around twice). You never calculate anything, never guess — the dots are already
        sitting on your scorecard before you ever tee off.
      </p>
    ),
  },
  {
    key: "doovers",
    title: "Do-overs",
    body: (
      <>
        <p>Once per round, you get two do-overs, and they&apos;re different:</p>
        <p>
          Breakfast ball — a mulligan on your very first tee shot of the round only. Rough opening
          drive? Re-tee it, no questions asked.
        </p>
        <p>
          Mulligan — a redo on any other shot in the round, except once your ball&apos;s on the
          green (no re-putting with this one). Use it on a shanked approach, a bad chip, whatever.
        </p>
        <p>
          Either way: whatever you make after the do-over is your real, final score for that hole.
          It&apos;s not a secret bonus — it counts everywhere the same as any other shot: the
          match, skins, your individual total.
        </p>
      </>
    ),
  },
  {
    key: "reverseMulligan",
    title: "The reverse mulligan — the team weapon",
    body: (
      <>
        <p>
          This is the one weapon in the whole trip that lets you mess with someone else&apos;s
          shot, not just your own.
        </p>
        <p>
          Once per team, per round — and it belongs to the whole team, not to one duo. Whichever
          of your team&apos;s two duos needs it first gets to use it; once it&apos;s gone,
          it&apos;s gone for both of you, even if you&apos;re out on a different hole at the same
          time.
        </p>
        <p>
          Here&apos;s the move: your team can force an opponent to replay any one shot he just
          hit — a drive, an approach, a chip, even a putt. He has to hit it again, right then, and
          play on from wherever the new ball ends up. He does not get to keep his first ball and
          play two — the replay is the shot now.
        </p>
        <p>
          The one exception, and it matters: if the shot you&apos;re reversing was already in the
          hole — like he just drained a birdie putt — that made shot still counts as real for his
          own skins and his own spot in the individual race. Your team&apos;s match sees his miss
          on the redo, but his personal scorecard and money still show the shot that actually
          went in. You can sabotage the team match; you can&apos;t erase a guy&apos;s birdie from
          his own life.
        </p>
        <p>
          Timing matters: you have to call it immediately, before the next shot gets hit. Wait too
          long, and it&apos;s off the table.
        </p>
      </>
    ),
  },
  {
    key: "individualRace",
    title: "Individual race",
    body: (
      <>
        <p>
          Runs the whole weekend, completely separate from the team stuff — this is just about
          you. Every shot you hit, minus whatever strokes your handicap gives you, adds up across
          both rounds. Lowest total wins, same as a normal golf tournament.
        </p>
        <p>
          Daily low net gets a nod each day too — no cash attached, just bragging rights for
          having the best round of the day.
        </p>
      </>
    ),
  },
  {
    key: "money",
    title: "Money — two things, that's it",
    body: (
      <>
        <p>Two things, and that&apos;s genuinely it — no other side bets are built into the app.</p>
        <p>
          <b>Skins.</b> Opt in before your round&apos;s own tee time — once you&apos;re in,
          you&apos;re in for the whole round, no backing out partway through. Gross score (no
          handicap strokes here), lowest score on a hole wins the whole pot for that hole
          outright.
        </p>
        <p>
          If two or more guys tie for the low score on a hole, nobody wins it — the money carries
          to the next hole, stacking up. So if hole 4 ties, whatever&apos;s riding on it rolls
          into hole 5&apos;s pot too, and keeps stacking until someone wins a hole outright.
        </p>
        <p>
          And if a whole round ends with skins still unclaimed — say the very last hole ties too —
          that money doesn&apos;t just disappear. It rolls forward into the next round&apos;s pot,
          so it&apos;s always fully in play until someone actually wins it.
        </p>
        <p>
          <b>The Challenge Ledger.</b> Any bet, between any two guys, about anything — closest to
          the pin, first three-putt of the day, whatever you dream up mid-round. Log it in the app
          with the terms and the stake. The other guy has to tap accept — that&apos;s what
          actually makes it official, not just typing it in. Once it&apos;s decided, mark the
          winner and it lands in both your running totals.
        </p>
      </>
    ),
  },
  {
    key: "ties",
    title: "How ties get broken",
    body: (
      <>
        <p>
          Nothing ever gets decided by the app flipping a coin — there&apos;s always a real
          tiebreaker, and if that runs out, it comes down to actual golf.
        </p>
        <p>
          For the Cup and for Sunday&apos;s earned pairings: first it&apos;s total points, then
          head-to-head (if those two teams already played each other), then total holes won across
          the whole weekend.
        </p>
        <p>
          For the individual title, it&apos;s different: first it&apos;s lowest cumulative net,
          then whoever played the better net round on Sunday, then whoever played the better net
          back-9 on Sunday.
        </p>
        <p>
          If either of those ladders somehow still ends dead even — genuinely tied after all of
          that — it comes down to a chip-off. Grab a wedge, head to the practice green, and settle
          it like it&apos;s supposed to be settled.
        </p>
      </>
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
