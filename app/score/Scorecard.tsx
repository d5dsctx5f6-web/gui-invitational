"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  computeIndividualRace,
  computeMatchState,
  matchScore,
  netScore,
  realScore,
  reverseMulliganStatus,
  type DuoHoleNets,
  type PlayerHoleNet,
  type SegmentState,
} from "@/engine/src";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";
import styles from "./Scorecard.module.css";
import type {
  ExistingHoleScore,
  ScorecardData,
  ScorecardPlayer,
  ScorecardReverseMulligan,
} from "./types";

interface HoleEntry {
  strokes: number;
  matchStrokes: number | null;
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

function rmKey(playerId: string, hole: number): string {
  return `${playerId}:${hole}`;
}

function entriesForHole(
  hole: number,
  players: ScorecardPlayer[],
  postedScores: ExistingHoleScore[],
  par: number,
  rmByPlayerHole: Map<string, ScorecardReverseMulligan>,
): Record<string, HoleEntry> {
  const next: Record<string, HoleEntry> = {};
  for (const p of players) {
    const existing = postedScores.find(
      (s) => s.playerId === p.id && s.hole === hole,
    );
    const rm = rmByPlayerHole.get(rmKey(p.id, hole));
    const holedRm = rm && rm.originalHoledScore !== null ? rm : null;

    if (holedRm) {
      // A made shot stays made: strokes is fixed to the real, already-holed score — only
      // match_strokes (the replay result) is adjustable.
      next[p.id] = {
        strokes: holedRm.originalHoledScore!,
        matchStrokes: existing?.matchStrokes ?? holedRm.originalHoledScore!,
        breakfastBall: existing?.breakfastBall ?? false,
        mulligan: existing?.mulligan ?? false,
      };
    } else {
      next[p.id] = existing
        ? {
            strokes: existing.strokes,
            matchStrokes: existing.matchStrokes,
            breakfastBall: existing.breakfastBall,
            mulligan: existing.mulligan,
          }
        : { strokes: par, matchStrokes: null, breakfastBall: false, mulligan: false };
    }
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

export function Scorecard({
  data,
  currentPlayerId,
}: {
  data: ScorecardData;
  currentPlayerId: string | null;
}) {
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [rmEvents, setRmEvents] = useState<ScorecardReverseMulligan[]>(
    data.reverseMulligans,
  );

  async function refetchHoleScores() {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("hole_scores")
      .select("player_id, hole, strokes, match_strokes, breakfast_ball, mulligan")
      .eq("round_id", data.roundId)
      .in(
        "player_id",
        allPlayers.map((p) => p.id),
      );
    setPostedScores(
      (rows ?? []).map((r) => ({
        playerId: r.player_id,
        hole: r.hole,
        strokes: r.strokes,
        matchStrokes: r.match_strokes,
        breakfastBall: r.breakfast_ball,
        mulligan: r.mulligan,
      })),
    );
  }

  async function refetchRmEvents() {
    const supabase = createClient();
    const { data: rows } = await supabase
      .from("reverse_mulligans")
      .select("id, team_id, hole, victim_player_id, original_holed_score")
      .eq("round_id", data.roundId)
      .in("team_id", [data.duoA.teamId, data.duoB.teamId]);
    setRmEvents(
      (rows ?? []).map((r) => ({
        id: r.id,
        teamId: r.team_id,
        hole: r.hole,
        victimPlayerId: r.victim_player_id,
        originalHoledScore: r.original_holed_score,
      })),
    );
  }

  const roundFilter = useMemo(
    () => ({ column: "round_id", value: data.roundId }),
    [data.roundId],
  );
  useRealtimeRefetch("hole_scores", roundFilter, refetchHoleScores);
  useRealtimeRefetch("reverse_mulligans", roundFilter, refetchRmEvents);

  const rmByPlayerHole = useMemo(() => {
    const map = new Map<string, ScorecardReverseMulligan>();
    for (const e of rmEvents) map.set(rmKey(e.victimPlayerId, e.hole), e);
    return map;
  }, [rmEvents]);

  const holeMeta = data.holes.find((h) => h.hole === currentHole)!;

  const [entries, setEntries] = useState<Record<string, HoleEntry>>(() =>
    entriesForHole(currentHole, allPlayers, postedScores, holeMeta.par, rmByPlayerHole),
  );
  const [renderedHole, setRenderedHole] = useState(currentHole);
  const [renderedRm, setRenderedRm] = useState(rmByPlayerHole);
  if (renderedHole !== currentHole || renderedRm !== rmByPlayerHole) {
    setRenderedHole(currentHole);
    setRenderedRm(rmByPlayerHole);
    setEntries(
      entriesForHole(currentHole, allPlayers, postedScores, holeMeta.par, rmByPlayerHole),
    );
  }

  const isDuoA = currentPlayerId !== null && data.duoA.players.some((p) => p.id === currentPlayerId);
  const isDuoB = currentPlayerId !== null && data.duoB.players.some((p) => p.id === currentPlayerId);
  const callingTeamId = isDuoA ? data.duoA.teamId : isDuoB ? data.duoB.teamId : null;
  const callingTeamName = isDuoA ? data.duoA.teamName : isDuoB ? data.duoB.teamName : null;
  const opposingPlayers = isDuoA ? data.duoB.players : isDuoB ? data.duoA.players : [];

  const rmStatus = useMemo(() => {
    if (!callingTeamId) return null;
    return reverseMulliganStatus(
      rmEvents.map((e) => ({ teamId: e.teamId, roundId: data.roundId, hole: e.hole })),
      callingTeamId,
      data.roundId,
    );
  }, [rmEvents, callingTeamId, data.roundId]);

  const [rmSheetOpen, setRmSheetOpen] = useState(false);
  const [rmVictimId, setRmVictimId] = useState<string | null>(null);
  const [rmWasHoled, setRmWasHoled] = useState(false);
  const [rmRealScore, setRmRealScore] = useState(4);
  const [rmBusy, setRmBusy] = useState(false);
  const [rmError, setRmError] = useState<string | null>(null);

  function openRmSheet() {
    setRmSheetOpen(true);
    setRmVictimId(null);
    setRmWasHoled(false);
    setRmRealScore(holeMeta.par);
    setRmError(null);
  }

  async function confirmRm() {
    if (!callingTeamId || !rmVictimId) return;
    setRmBusy(true);
    setRmError(null);

    const supabase = createClient();
    const { error: rmInsertError } = await supabase.from("reverse_mulligans").insert({
      team_id: callingTeamId,
      round_id: data.roundId,
      hole: currentHole,
      victim_player_id: rmVictimId,
      original_holed_score: rmWasHoled ? rmRealScore : null,
    });

    setRmBusy(false);

    if (rmInsertError) {
      setRmError(
        rmInsertError.code === "23505"
          ? "Your team's reverse mulligan is already used this round."
          : rmInsertError.message,
      );
      return;
    }

    setRmSheetOpen(false);
    await refetchRmEvents();
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

  const runningTotals = useMemo(() => {
    const grossByPlayer = new Map<string, number>();
    for (const s of postedScores) {
      grossByPlayer.set(s.playerId, (grossByPlayer.get(s.playerId) ?? 0) + s.strokes);
    }

    const netEntries: PlayerHoleNet[] = postedScores.map((s) => {
      const player = allPlayers.find((p) => p.id === s.playerId)!;
      return {
        playerId: s.playerId,
        roundId: data.roundId,
        hole: s.hole,
        net: netScore(realScore(s), player.dotsByHole[s.hole - 1]),
      };
    });
    const race = computeIndividualRace(netEntries);

    return allPlayers.map((p) => {
      const standing = race.standings.find((s) => s.playerId === p.id);
      return {
        playerId: p.id,
        name: p.name,
        gross: grossByPlayer.get(p.id) ?? 0,
        net: standing?.cumulativeNet ?? 0,
        holesPlayed: standing?.holesPlayed ?? 0,
      };
    });
  }, [postedScores, allPlayers, data.roundId]);

  const isEditingExisting = allPlayers.every((p) =>
    postedScores.some((s) => s.playerId === p.id && s.hole === currentHole),
  );

  function usedOnOtherHole(
    playerId: string,
    flag: "breakfastBall" | "mulligan",
  ): number | null {
    const row = postedScores.find(
      (s) => s.playerId === playerId && s[flag] && s.hole !== currentHole,
    );
    return row ? row.hole : null;
  }

  function stepper(playerId: string, field: "strokes" | "matchStrokes", delta: number) {
    setEntries((prev) => {
      const current = prev[playerId];
      const base = field === "matchStrokes" ? (current.matchStrokes ?? current.strokes) : current.strokes;
      return {
        ...prev,
        [playerId]: { ...current, [field]: Math.max(1, base + delta) },
      };
    });
  }

  function toggleFlag(playerId: string, flag: "breakfastBall" | "mulligan") {
    if (usedOnOtherHole(playerId, flag) !== null) return;
    setEntries((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [flag]: !prev[playerId][flag] },
    }));
  }

  async function postHole() {
    const postedHole = currentHole;
    setPosting(true);
    setError(null);
    setSuccessMessage(null);

    const rows = allPlayers.map((p) => {
      const holedRm = rmByPlayerHole.get(rmKey(p.id, postedHole));
      const hasDivergence = holedRm?.originalHoledScore != null;
      return {
        player_id: p.id,
        round_id: data.roundId,
        hole: postedHole,
        strokes: entries[p.id].strokes,
        match_strokes: hasDivergence ? entries[p.id].matchStrokes : null,
        breakfast_ball: entries[p.id].breakfastBall,
        mulligan: entries[p.id].mulligan,
      };
    });

    const supabase = createClient();
    const { error: upsertError } = await supabase
      .from("hole_scores")
      .upsert(rows, { onConflict: "player_id,round_id,hole" });

    setPosting(false);

    if (upsertError) {
      setError(`Hole ${postedHole} did not save: ${upsertError.message}`);
      return;
    }

    setPostedScores((prev) => {
      const withoutThisHole = prev.filter(
        (s) =>
          !(s.hole === postedHole && allPlayers.some((p) => p.id === s.playerId)),
      );
      const newRows: ExistingHoleScore[] = rows.map((r) => ({
        playerId: r.player_id,
        hole: r.hole,
        strokes: r.strokes,
        matchStrokes: r.match_strokes,
        breakfastBall: r.breakfast_ball,
        mulligan: r.mulligan,
      }));
      return [...withoutThisHole, ...newRows];
    });
    setSuccessMessage(`Hole ${postedHole} posted — saved to Supabase`);
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
          onClick={() => {
            setSuccessMessage(null);
            setError(null);
            setCurrentHole((h) => Math.max(1, h - 1));
          }}
        >
          ← Hole {currentHole - 1}
        </button>
        <button
          className={styles.navbtn}
          disabled={currentHole === 18}
          onClick={() => {
            setSuccessMessage(null);
            setError(null);
            setCurrentHole((h) => Math.min(18, h + 1));
          }}
        >
          Hole {currentHole + 1} →
        </button>
      </div>

      {successMessage && (
        <div className={styles.success} role="status">
          ✓ {successMessage}
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          ⚠ {error}
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardhead}>
          <h2>Hole {currentHole} scores</h2>
          {isEditingExisting ? (
            <div className={styles.editingBadge}>Already posted — editing</div>
          ) : (
            <div className={styles.meta}>gross · dots = strokes</div>
          )}
        </div>
        {allPlayers.map((p) => {
          const entry = entries[p.id];
          if (!entry) return null;
          const dots = p.dotsByHole[currentHole - 1];
          const bbUsedElsewhere =
            currentHole === 1 ? null : usedOnOtherHole(p.id, "breakfastBall");
          const mullUsedElsewhere = usedOnOtherHole(p.id, "mulligan");
          const holedRm = rmByPlayerHole.get(rmKey(p.id, currentHole));
          const hasDivergence = holedRm?.originalHoledScore != null;

          return (
            <div className={styles.prow} key={p.id}>
              <div>
                <div className={styles.pname}>
                  {p.name}
                  {dots > 0 && (
                    <span className={styles.dots}>{"•".repeat(dots)}</span>
                  )}
                </div>
                {hasDivergence && (
                  <div className={styles.rmNote}>
                    RM called — real score {holedRm!.originalHoledScore} stands for
                    skins/individual
                  </div>
                )}
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
              {hasDivergence ? (
                <div>
                  <div className={styles.stepper}>
                    <button
                      className={styles.stepbtn}
                      aria-label="minus"
                      onClick={() => stepper(p.id, "matchStrokes", -1)}
                    >
                      −
                    </button>
                    <div className={styles.scoreval}>
                      {entry.matchStrokes ?? entry.strokes}
                    </div>
                    <button
                      className={styles.stepbtn}
                      aria-label="plus"
                      onClick={() => stepper(p.id, "matchStrokes", 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className={styles.hint}>match score (replay)</div>
                </div>
              ) : (
                <div className={styles.stepper}>
                  <button
                    className={styles.stepbtn}
                    aria-label="minus"
                    onClick={() => stepper(p.id, "strokes", -1)}
                  >
                    −
                  </button>
                  <div className={styles.scoreval}>{entry.strokes}</div>
                  <button
                    className={styles.stepbtn}
                    aria-label="plus"
                    onClick={() => stepper(p.id, "strokes", 1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {callingTeamId && (
        <div className={styles.rmbar}>
          <div className={styles.rmtxt}>
            <b>{callingTeamName}&apos;s reverse mulligan</b>
            <br />
            {rmStatus?.available
              ? "In the holster"
              : `Used on hole ${rmStatus?.usedOnHole}`}
          </div>
          {rmStatus?.available && !rmSheetOpen && (
            <button className={styles.navbtn} onClick={openRmSheet}>
              Call reverse mulligan
            </button>
          )}
        </div>
      )}

      {rmSheetOpen && (
        <div className={styles.card}>
          <div className={styles.cardhead}>
            <h2>Call reverse mulligan — hole {currentHole}</h2>
          </div>
          <div className={styles.hint}>Victim</div>
          <div className={styles.ptags} style={{ marginBottom: 10 }}>
            {opposingPlayers.map((op) => (
              <button
                key={op.id}
                className={`${styles.chip} ${
                  rmVictimId === op.id ? styles.chipPending : styles.chipAvail
                }`}
                onClick={() => setRmVictimId(op.id)}
              >
                {op.name}
              </button>
            ))}
          </div>
          <div className={styles.hint}>Was the shot already holed?</div>
          <div className={styles.ptags} style={{ marginBottom: 10 }}>
            <button
              className={`${styles.chip} ${!rmWasHoled ? styles.chipPending : styles.chipAvail}`}
              onClick={() => setRmWasHoled(false)}
            >
              No — replay counts directly
            </button>
            <button
              className={`${styles.chip} ${rmWasHoled ? styles.chipPending : styles.chipAvail}`}
              onClick={() => setRmWasHoled(true)}
            >
              Yes — it went in
            </button>
          </div>
          {rmWasHoled && (
            <>
              <div className={styles.hint}>Real score on hole {currentHole}</div>
              <div className={styles.stepper} style={{ marginBottom: 10 }}>
                <button
                  className={styles.stepbtn}
                  aria-label="minus"
                  onClick={() => setRmRealScore((v) => Math.max(1, v - 1))}
                >
                  −
                </button>
                <div className={styles.scoreval}>{rmRealScore}</div>
                <button
                  className={styles.stepbtn}
                  aria-label="plus"
                  onClick={() => setRmRealScore((v) => v + 1)}
                >
                  +
                </button>
              </div>
            </>
          )}
          {rmError && (
            <div className={styles.error} role="alert">
              ⚠ {rmError}
            </div>
          )}
          <div className={styles.navrow} style={{ marginTop: 10 }}>
            <button className={styles.navbtn} onClick={() => setRmSheetOpen(false)}>
              Cancel
            </button>
            <button
              className={styles.navbtn}
              disabled={!rmVictimId || rmBusy}
              onClick={confirmRm}
            >
              {rmBusy ? "…" : "Confirm call"}
            </button>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardhead}>
          <h2>Running totals</h2>
          <div className={styles.meta}>thru · gross · net</div>
        </div>
        {runningTotals.map((t) => (
          <div className={styles.totalsRow} key={t.playerId}>
            <span className={styles.totalsName}>{t.name}</span>
            <span className={styles.totalsThru}>thru {t.holesPlayed}</span>
            <span className={styles.totalsVal}>{t.gross}</span>
            <span className={styles.totalsVal}>{t.net}</span>
          </div>
        ))}
      </div>

      <button className={styles.postbtn} disabled={posting} onClick={postHole}>
        {posting ? "Posting…" : `Post hole ${currentHole}`}
      </button>
      <div className={styles.hint}>
        Posting writes to Supabase and advances to the next hole
      </div>
    </main>
  );
}
