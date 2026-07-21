"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeMatchState,
  matchScore,
  netScore,
  type DuoHoleNets,
  type SegmentState,
} from "@/engine/src";
import { getSupabase } from "@/lib/supabase";
import styles from "./Scorecard.module.css";
import type { ExistingHoleScore, ScorecardData, ScorecardPlayer } from "./types";

interface HoleEntry {
  strokes: number;
  breakfastBall: boolean;
  mulligan: boolean;
}

function firstUnpostedHole(
  scores: ExistingHoleScore[],
  players: ScorecardPlayer[],
): number {
  for (let hole = 1; hole <= 18; hole++) {
    const allPosted = players.every((p) =>
      scores.some((s) => s.playerId === p.id && s.hole === hole),
    );
    if (!allPosted) return hole;
  }
  return 18;
}

function entriesForHole(
  hole: number,
  players: ScorecardPlayer[],
  postedScores: ExistingHoleScore[],
  par: number,
): Record<string, HoleEntry> {
  const next: Record<string, HoleEntry> = {};
  for (const p of players) {
    const existing = postedScores.find(
      (s) => s.playerId === p.id && s.hole === hole,
    );
    next[p.id] = existing
      ? {
          strokes: existing.strokes,
          breakfastBall: existing.breakfastBall,
          mulligan: existing.mulligan,
        }
      : { strokes: par, breakfastBall: false, mulligan: false };
  }
  return next;
}

function formatSegment(
  seg: SegmentState,
  aName: string,
  bName: string,
): string {
  if (seg.holesUp === 0) {
    return seg.status === "closed" ? "Halved" : `All square · thru ${seg.thru}`;
  }
  const leader = seg.holesUp > 0 ? aName : bName;
  const suffix = seg.status === "closed" ? "" : ` · thru ${seg.thru}`;
  return `${leader} ${Math.abs(seg.holesUp)}UP${suffix}`;
}

export function Scorecard({ data }: { data: ScorecardData }) {
  const allPlayers = useMemo(
    () => [...data.duoA.players, ...data.duoB.players],
    [data],
  );

  const [currentHole, setCurrentHole] = useState(() =>
    firstUnpostedHole(data.existingScores, allPlayers),
  );
  const [postedScores, setPostedScores] = useState<ExistingHoleScore[]>(
    data.existingScores,
  );
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const holeMeta = data.holes.find((h) => h.hole === currentHole)!;

  const [entries, setEntries] = useState<Record<string, HoleEntry>>(() =>
    entriesForHole(currentHole, allPlayers, postedScores, holeMeta.par),
  );
  const [renderedHole, setRenderedHole] = useState(currentHole);
  if (renderedHole !== currentHole) {
    setRenderedHole(currentHole);
    setEntries(entriesForHole(currentHole, allPlayers, postedScores, holeMeta.par));
  }

  const matchState = useMemo(() => {
    const holes: DuoHoleNets[] = data.holes.map((h) => {
      const netFor = (players: ScorecardPlayer[]) =>
        players
          .map((p) => {
            const s = postedScores.find(
              (sc) => sc.playerId === p.id && sc.hole === h.hole,
            );
            return s ? netScore(matchScore(s), p.dotsByHole[h.hole - 1]) : null;
          })
          .filter((n): n is number => n !== null);

      return {
        hole: h.hole,
        duoANet: netFor(data.duoA.players),
        duoBNet: netFor(data.duoB.players),
      };
    });
    return computeMatchState(holes);
  }, [postedScores, data]);

  function usedOnOtherHole(
    playerId: string,
    flag: "breakfastBall" | "mulligan",
  ): number | null {
    const row = postedScores.find(
      (s) => s.playerId === playerId && s[flag] && s.hole !== currentHole,
    );
    return row ? row.hole : null;
  }

  function stepper(playerId: string, delta: number) {
    setEntries((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        strokes: Math.max(1, prev[playerId].strokes + delta),
      },
    }));
  }

  function toggleFlag(playerId: string, flag: "breakfastBall" | "mulligan") {
    if (usedOnOtherHole(playerId, flag) !== null) return;
    setEntries((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [flag]: !prev[playerId][flag] },
    }));
  }

  async function postHole() {
    setPosting(true);
    setError(null);

    const rows = allPlayers.map((p) => ({
      player_id: p.id,
      round_id: data.roundId,
      hole: currentHole,
      strokes: entries[p.id].strokes,
      breakfast_ball: entries[p.id].breakfastBall,
      mulligan: entries[p.id].mulligan,
    }));

    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from("hole_scores")
      .upsert(rows, { onConflict: "player_id,round_id,hole" });

    setPosting(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    setPostedScores((prev) => {
      const withoutThisHole = prev.filter(
        (s) =>
          !(s.hole === currentHole && allPlayers.some((p) => p.id === s.playerId)),
      );
      const newRows: ExistingHoleScore[] = allPlayers.map((p) => ({
        playerId: p.id,
        hole: currentHole,
        strokes: entries[p.id].strokes,
        matchStrokes: null,
        breakfastBall: entries[p.id].breakfastBall,
        mulligan: entries[p.id].mulligan,
      }));
      return [...withoutThisHole, ...newRows];
    });
    setCurrentHole((h) => Math.min(h + 1, 18));
  }

  const aName = data.duoA.teamName;
  const bName = data.duoB.teamName;

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>
        ← Roster
      </Link>
      <div className={styles.eyebrow}>
        Scorekeeper · <b>{aName} v {bName}</b>
      </div>

      <div className={styles.segs}>
        {(
          [
            ["F9", matchState.front9],
            ["B9", matchState.back9],
            ["18", matchState.overall18],
          ] as const
        ).map(([label, seg]) => (
          <div
            key={label}
            className={`${styles.seg} ${seg.status === "closed" ? styles.segClosed : ""}`}
          >
            {label}
            <b>{formatSegment(seg, aName, bName)}</b>
          </div>
        ))}
      </div>

      <div className={styles.holehead}>
        <div className={styles.bignum}>{currentHole}</div>
        <div className={styles.holemeta}>
          <b>Par {holeMeta.par}</b>
          {holeMeta.yardage ? ` · ${holeMeta.yardage} yds` : ""}
          <br />
          Stroke index {holeMeta.strokeIndex}
        </div>
      </div>

      <div className={styles.navrow}>
        <button
          className={styles.navbtn}
          disabled={currentHole === 1}
          onClick={() => setCurrentHole((h) => Math.max(1, h - 1))}
        >
          ← Hole {currentHole - 1}
        </button>
        <button
          className={styles.navbtn}
          disabled={currentHole === 18}
          onClick={() => setCurrentHole((h) => Math.min(18, h + 1))}
        >
          Hole {currentHole + 1} →
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardhead}>
          <h2>Hole {currentHole} scores</h2>
          <div className={styles.meta}>gross · dots = strokes</div>
        </div>
        {allPlayers.map((p) => {
          const entry = entries[p.id];
          if (!entry) return null;
          const dots = p.dotsByHole[currentHole - 1];
          const bbUsedElsewhere =
            currentHole === 1 ? null : usedOnOtherHole(p.id, "breakfastBall");
          const mullUsedElsewhere = usedOnOtherHole(p.id, "mulligan");

          return (
            <div className={styles.prow} key={p.id}>
              <div>
                <div className={styles.pname}>
                  {p.name}
                  {dots > 0 && (
                    <span className={styles.dots}>{"•".repeat(dots)}</span>
                  )}
                </div>
                <div className={styles.ptags}>
                  {currentHole === 1 && (
                    <button
                      className={`${styles.chip} ${
                        bbUsedElsewhere !== null
                          ? styles.chipUsed
                          : entry.breakfastBall
                            ? styles.chipPending
                            : styles.chipAvail
                      }`}
                      disabled={bbUsedElsewhere !== null}
                      onClick={() => toggleFlag(p.id, "breakfastBall")}
                    >
                      {bbUsedElsewhere !== null
                        ? "BB used"
                        : entry.breakfastBall
                          ? "BB — will use"
                          : "BB avail"}
                    </button>
                  )}
                  <button
                    className={`${styles.chip} ${
                      mullUsedElsewhere !== null
                        ? styles.chipUsed
                        : entry.mulligan
                          ? styles.chipPending
                          : styles.chipAvail
                    }`}
                    disabled={mullUsedElsewhere !== null}
                    onClick={() => toggleFlag(p.id, "mulligan")}
                  >
                    {mullUsedElsewhere !== null
                      ? `Mull used on ${mullUsedElsewhere}`
                      : entry.mulligan
                        ? "Mull — will use"
                        : "Mull avail"}
                  </button>
                </div>
              </div>
              <div className={styles.stepper}>
                <button
                  className={styles.stepbtn}
                  aria-label="minus"
                  onClick={() => stepper(p.id, -1)}
                >
                  −
                </button>
                <div className={styles.scoreval}>{entry.strokes}</div>
                <button
                  className={styles.stepbtn}
                  aria-label="plus"
                  onClick={() => stepper(p.id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button className={styles.postbtn} disabled={posting} onClick={postHole}>
        {posting ? "Posting…" : `Post hole ${currentHole}`}
      </button>
      <div className={styles.hint}>
        Posting writes to Supabase and advances to the next hole
      </div>
    </main>
  );
}
