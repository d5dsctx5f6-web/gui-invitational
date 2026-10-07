"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bestBallDuoStrokes,
  buildMatchHoles,
  canScoreDuo,
  cappedStrokes,
  computeMatchState,
  countingPlayerIds,
  drivesUsedTally,
  formatPoints,
  groupTeeTimeIso,
  liveNote,
  nextUnpostedHole,
  postedHoles,
  resolveHoleResults,
  reverseMulliganStatus,
  segmentLabel,
  type BestBallRow,
  type ScrambleRow,
} from "@/engine/src";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";
import { formatArizonaTime } from "@/lib/timezone";
import { Card } from "../design-preview/components/Card";
import { Chip } from "../design-preview/components/Chip";
import { ThemeToggle } from "../design-preview/components/ThemeToggle";
import { clearPlayerHoleScores, exitQa } from "./actions";
import { fetchSnapshot } from "./fetchSnapshot";
import type { ScoreData, ScoreDuo, ScorePlayer, ScoreSnapshot } from "./types";
import styles from "./Scorecard.module.css";

const MIN_STROKES = 1;
const MAX_STROKES = 20;

type SaveState = "idle" | "saving" | "error";

/** What the scorekeeper has typed for the hole they're on (not yet posted). */
interface Entry {
  scramble: { a: number; b: number; teeA: string | null; teeB: string | null };
  /** Best ball: one entry per player. */
  bestBall: Record<string, { strokes: number; pickedUp: boolean }>;
}

function duoPlayers(duo: ScoreDuo): ScorePlayer[] {
  return duo.player2 ? [duo.player1, duo.player2] : [duo.player1];
}

function duoLabel(duo: ScoreDuo): string {
  return duoPlayers(duo)
    .map((p) => p.name)
    .join(" + ");
}

export function Scorecard({ data }: { data: ScoreData }) {
  const { round, duoA, duoB, me, parByHole } = data;
  const supabase = useMemo(() => createClient(), []);
  const isScramble = round.format === "scramble";
  const allPlayers = useMemo(() => [...duoPlayers(duoA), ...duoPlayers(duoB)], [duoA, duoB]);
  const nameOf = useCallback(
    (id: string | null) => (id === null ? "the commissioner" : allPlayers.find((p) => p.id === id)?.name ?? "someone"),
    [allPlayers],
  );

  const [snapshot, setSnapshot] = useState<ScoreSnapshot>(data.initial);

  // ---- derived match state: ONE engine, both formats ------------------------------------------
  const holes = useMemo(
    () =>
      buildMatchHoles({
        format: round.format,
        parByHole,
        duoAId: duoA.id,
        duoBId: duoB.id,
        scrambleRows: snapshot.scramble.map<ScrambleRow>((r) => ({ duoId: r.duoId, hole: r.hole, strokes: r.strokes })),
        bestBallRows: snapshot.bestBall.map<BestBallRow>((r) => ({
          duoId: r.duoId,
          playerId: r.playerId,
          hole: r.hole,
          strokes: r.strokes,
        })),
      }),
    [round.format, parByHole, duoA.id, duoB.id, snapshot],
  );
  const matchState = useMemo(() => computeMatchState(holes), [holes]);
  const results = useMemo(() => resolveHoleResults(holes), [holes]);
  const posted = useMemo(() => postedHoles(holes), [holes]);
  const note = liveNote(matchState);

  const mySide: "A" | "B" = duoA.player1.id === me.id || duoA.player2?.id === me.id ? "A" : "B";
  const canScore = canScoreDuo(
    me.id,
    duoA.id,
    [duoA, duoB].map((d) => ({
      id: d.id,
      roundId: round.id,
      matchSlot: d.matchSlot,
      playerIds: [d.player1.id, d.player2?.id ?? null],
    })),
  );

  // ---- the hole being viewed / entered --------------------------------------------------------
  const [hole, setHole] = useState<number>(() => nextUnpostedHole(postedHoles(holes)) ?? 18);
  const holeRef = useRef(hole);
  const par = parByHole[hole - 1];
  const max = cappedStrokes(Number.MAX_SAFE_INTEGER, par);
  const yards = data.yardageByHole[hole - 1];
  const isPosted = posted.includes(hole);

  const defaultsFor = useCallback(
    (h: number, snap: ScoreSnapshot): Entry => {
      const p = parByHole[h - 1];
      const sc = (duoId: string) => snap.scramble.find((r) => r.duoId === duoId && r.hole === h);
      const onlyPlayerA = duoA.player2 ? null : duoA.player1.id; // short-handed: preselect the one player
      const onlyPlayerB = duoB.player2 ? null : duoB.player1.id;
      const a = sc(duoA.id);
      const b = sc(duoB.id);
      const bestBall: Entry["bestBall"] = {};
      for (const pl of allPlayers) {
        const row = snap.bestBall.find((r) => r.playerId === pl.id && r.hole === h);
        const duoPosted = snap.bestBall.some(
          (r) => r.hole === h && r.duoId === (duoPlayers(duoA).some((x) => x.id === pl.id) ? duoA.id : duoB.id),
        );
        bestBall[pl.id] = row
          ? { strokes: row.strokes, pickedUp: false }
          : { strokes: p, pickedUp: duoPosted }; // posted hole + no row for him = he picked up
      }
      return {
        scramble: {
          a: a?.strokes ?? p,
          b: b?.strokes ?? p,
          teeA: a ? a.teeShotPlayerId : onlyPlayerA,
          teeB: b ? b.teeShotPlayerId : onlyPlayerB,
        },
        bestBall,
      };
    },
    [parByHole, duoA, duoB, allPlayers],
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [entry, setEntry] = useState<Entry>(() => defaultsFor(hole, data.initial));
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const goToHole = useCallback(
    (h: number, snap: ScoreSnapshot = snapshot) => {
      const clamped = Math.max(1, Math.min(18, h));
      setHole(clamped);
      setEntry(defaultsFor(clamped, snap));
      setDirty(false);
      setNotice(null);
      setSave("idle");
    },
    [defaultsFor, snapshot],
  );

  // ---- live updates ---------------------------------------------------------------------------
  const snapshotRef = useRef(snapshot);
  // Refs are refreshed after render (not during it) so the realtime callback always reads fresh values.
  useEffect(() => {
    holeRef.current = hole;
    dirtyRef.current = dirty;
    snapshotRef.current = snapshot;
  });

  const refetch = useCallback(async () => {
    let next: ScoreSnapshot;
    try {
      next = await fetchSnapshot(supabase, round.format, round.id, [duoA.id, duoB.id]);
    } catch {
      return; // offline or transient: keep what's on screen; the next event/focus refetches
    }
    const h = holeRef.current;
    const sig = (s: ScoreSnapshot) =>
      JSON.stringify([
        s.scramble.filter((r) => r.hole === h).map((r) => [r.duoId, r.strokes, r.teeShotPlayerId, r.updatedAt]),
        s.bestBall.filter((r) => r.hole === h).map((r) => [r.playerId, r.strokes, r.updatedAt]),
      ]);
    const changedHere = sig(snapshotRef.current) !== sig(next);
    setSnapshot(next);

    if (changedHere) {
      const touched = [...next.scramble, ...next.bestBall]
        .filter((r) => r.hole === h)
        .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0];
      if (touched && touched.updatedBy !== me.id) {
        setNotice(`Hole ${h} updated by ${nameOf(touched.updatedBy)}`);
        if (!dirtyRef.current) setEntry(defaultsFor(h, next));
      }
    }
  }, [supabase, round.format, round.id, duoA.id, duoB.id, me.id, nameOf, defaultsFor]);

  const scoresFilter = useMemo(() => ({ column: "round_id", value: round.id }), [round.id]);
  useRealtimeRefetch(isScramble ? "hole_scores" : "player_hole_scores", scoresFilter, refetch);
  useRealtimeRefetch("reverse_mulligans", scoresFilter, refetch);

  // ---- posting --------------------------------------------------------------------------------
  const [saveError, setSaveError] = useState<string | null>(null);

  const bestBallCounts = useMemo(() => {
    const duoCount = (duo: ScoreDuo) => {
      const values = duoPlayers(duo).map((p) => (entry.bestBall[p.id]?.pickedUp ? null : entry.bestBall[p.id]?.strokes ?? null));
      return bestBallDuoStrokes(values);
    };
    return { a: duoCount(duoA), b: duoCount(duoB) };
  }, [entry.bestBall, duoA, duoB]);

  const canPost = isScramble ? true : bestBallCounts.a !== null && bestBallCounts.b !== null;

  async function postHole() {
    if (!canScore || save === "saving") return;
    setSave("saving");
    setSaveError(null);
    const wasPosted = isPosted;
    try {
      if (isScramble) {
        const rows = [
          { duo_id: duoA.id, round_id: round.id, hole, strokes: entry.scramble.a, tee_shot_used_player_id: entry.scramble.teeA },
          { duo_id: duoB.id, round_id: round.id, hole, strokes: entry.scramble.b, tee_shot_used_player_id: entry.scramble.teeB },
        ];
        const { error } = await supabase.from("hole_scores").upsert(rows, { onConflict: "duo_id,round_id,hole" });
        if (error) throw new Error(error.message);
      } else {
        const rows: { duo_id: string; round_id: string; player_id: string; hole: number; strokes: number }[] = [];
        const pickedUpWithRow: string[] = [];
        for (const duo of [duoA, duoB]) {
          for (const p of duoPlayers(duo)) {
            const e = entry.bestBall[p.id];
            if (!e || e.pickedUp) {
              if (snapshot.bestBall.some((r) => r.playerId === p.id && r.hole === hole)) pickedUpWithRow.push(p.id);
              continue;
            }
            rows.push({ duo_id: duo.id, round_id: round.id, player_id: p.id, hole, strokes: e.strokes });
          }
        }
        const { error } = await supabase.from("player_hole_scores").upsert(rows, { onConflict: "player_id,round_id,hole" });
        if (error) throw new Error(error.message);
        if (pickedUpWithRow.length > 0) {
          const res = await clearPlayerHoleScores(round.id, hole, pickedUpWithRow);
          if (!res.ok) throw new Error(res.message ?? "Couldn't clear a picked-up score");
        }
      }

      const next = await fetchSnapshot(supabase, round.format, round.id, [duoA.id, duoB.id]);
      setSnapshot(next);
      setSave("idle");
      setDirty(false);
      setNotice(null);
      if (!wasPosted) {
        const nextHole = nextUnpostedHole(postedHoles(buildHolesFor(next)));
        goToHole(nextHole ?? hole, next);
      } else {
        setEntry(defaultsFor(hole, next));
        setNotice(`Hole ${hole} saved`);
      }
    } catch (err) {
      // A failed post never vanishes: the entered values stay on screen and nothing advances.
      setSave("error");
      setSaveError(err instanceof Error ? err.message : "Network error");
    }
  }

  function buildHolesFor(snap: ScoreSnapshot) {
    return buildMatchHoles({
      format: round.format,
      parByHole,
      duoAId: duoA.id,
      duoBId: duoB.id,
      scrambleRows: snap.scramble.map((r) => ({ duoId: r.duoId, hole: r.hole, strokes: r.strokes })),
      bestBallRows: snap.bestBall.map((r) => ({ duoId: r.duoId, playerId: r.playerId, hole: r.hole, strokes: r.strokes })),
    });
  }

  // ---- reverse mulligan -----------------------------------------------------------------------
  const rmEvents = snapshot.mulligans.map((m) => ({ duoId: m.duoId, roundId: round.id, hole: m.hole }));
  const [rmConfirm, setRmConfirm] = useState<"A" | "B" | null>(null);
  const [rmError, setRmError] = useState<string | null>(null);

  async function callMulligan(side: "A" | "B") {
    const duo = side === "A" ? duoA : duoB;
    setRmError(null);
    const { error } = await supabase.from("reverse_mulligans").insert({ duo_id: duo.id, round_id: round.id, hole });
    setRmConfirm(null);
    if (error) {
      setRmError(error.code === "23505" ? "That duo already used its reverse mulligan this round." : "Couldn't record it — tap to try again.");
    }
    await refetch();
  }

  // ---- display helpers ------------------------------------------------------------------------
  const teeTime = (duo: ScoreDuo) =>
    round.firstTeeTime ? formatArizonaTime(groupTeeTimeIso(round.firstTeeTime, round.intervalMinutes, duo.matchSlot)) : null;

  const holeResult = results[hole - 1]?.winner ?? null;
  const banner =
    isPosted && holeResult
      ? holeResult === "halved"
        ? { text: `Hole ${hole} halved`, tone: "halved" }
        : holeResult === "A"
          ? { text: `North won hole ${hole}`, tone: "north" }
          : { text: `South won hole ${hole}`, tone: "south" }
      : null;

  const tiles = results.map((r) => {
    if (r.winner === null) return { hole: r.hole, label: "·", tone: "none" };
    if (r.winner === "halved") return { hole: r.hole, label: "H", tone: "halved" };
    const mine = r.winner === mySide;
    return { hole: r.hole, label: mine ? "W" : "L", tone: mine ? "win" : "loss" };
  });

  const driveTally = isScramble
    ? drivesUsedTally(
        snapshot.scramble
          .filter((r) => r.teeShotPlayerId)
          .map((r) => ({ roundId: round.id, hole: r.hole, playerId: r.teeShotPlayerId! })),
      )
    : {};
  const grossTotals: Record<string, number> = {};
  if (!isScramble) for (const r of snapshot.bestBall) grossTotals[r.playerId] = (grossTotals[r.playerId] ?? 0) + r.strokes;

  // Keep a stale notice from lingering when the player moves on.
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  const touch = () => setDirty(true);

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.back}>
          ← Home
        </Link>
        <ThemeToggle />
      </div>

      {data.otherRounds.length > 0 && (
        <div className={styles.rounds}>
          {data.otherRounds.map((r) => (
            <Link key={r.id} href={`/score?round=${r.id}`} className={styles.roundChip}>
              {r.label}
            </Link>
          ))}
        </div>
      )}

      {/* ---------------- match header ---------------- */}
      <Card>
        <div className={styles.matchHead}>
          <div className={styles.metaRow}>
            <Chip variant="live" pulse>
              Slot {duoA.matchSlot}
            </Chip>
            {teeTime(duoA) && <span className={styles.meta}>Tee {teeTime(duoA)}</span>}
            <span className={styles.meta}>{isScramble ? "Scramble" : "Best ball"}</span>
            <span className={styles.meta}>
              {round.courseName}
              {round.teeName ? ` · ${round.teeName}` : ""}
            </span>
          </div>
          <div className={styles.duoRow}>
            <span className={`${styles.duoName} ${styles.north}`}>{duoLabel(duoA)}</span>
            <span className={styles.vs}>vs</span>
            <span className={`${styles.duoName} ${styles.south}`}>{duoLabel(duoB)}</span>
          </div>
          <div className={styles.segments} aria-label="Match status">
            {(
              [
                ["F9", matchState.front9],
                ["B9", matchState.back9],
                ["18", matchState.overall18],
              ] as const
            ).map(([label, seg]) => {
              const l = segmentLabel(seg);
              return (
                <div key={label} className={`${styles.segment} ${styles[`tone_${l.tone}`]}`}>
                  <span className={styles.segLabel}>{label}</span>
                  <span className={styles.segText}>{l.text}</span>
                </div>
              );
            })}
          </div>
          <div className={styles.points}>
            Points · North {formatPoints(matchState.totalPoints.a)} – South {formatPoints(matchState.totalPoints.b)}
          </div>
          {note && <div className={styles.liveNote}>{note}</div>}
        </div>
      </Card>

      {/* ---------------- hole header + nav ---------------- */}
      <div className={styles.holeHead}>
        <button type="button" className={styles.navBtn} onClick={() => goToHole(hole - 1)} disabled={hole <= 1} aria-label="Previous hole">
          ‹
        </button>
        <div className={styles.holeInfo}>
          <div className={styles.holeNumber}>Hole {hole}</div>
          <div className={styles.holeMeta}>
            Par {par}
            {yards ? ` · ${yards} yds` : ""} · <b>Max {max}</b>
          </div>
        </div>
        <button type="button" className={styles.navBtn} onClick={() => goToHole(hole + 1)} disabled={hole >= 18} aria-label="Next hole">
          ›
        </button>
      </div>

      {banner && <div className={`${styles.banner} ${styles[`tone_${banner.tone}`]}`}>{banner.text}</div>}
      {notice && <div className={styles.notice}>{notice}</div>}

      {!canScore && <div className={styles.notice}>You&apos;re viewing this match — only its four players can post scores.</div>}

      {/* ---------------- entry ---------------- */}
      {canScore && isScramble && (
        <div className={styles.entry}>
          {([
            [duoA, "a", "teeA"],
            [duoB, "b", "teeB"],
          ] as const).map(([duo, key, teeKey]) => {
            const value = entry.scramble[key];
            return (
              <Card key={duo.id} edge={duo.side === "A" ? "north" : "south"}>
                <div className={styles.entryDuo}>
                  <div className={`${styles.entryTitle} ${duo.side === "A" ? styles.north : styles.south}`}>{duoLabel(duo)}</div>
                  <ScoreStepper
                    value={value}
                    onChange={(v) => {
                      touch();
                      setEntry((e) => ({ ...e, scramble: { ...e.scramble, [key]: v } }));
                    }}
                    label={`${duo.teamName} score`}
                  />
                  {value > max && <div className={styles.cap}>counts as {cappedStrokes(value, par)} (mercy cap)</div>}
                  <div className={styles.driveRow} aria-label="Drives Used">
                    <span className={styles.driveLabel}>Drive used</span>
                    {duoPlayers(duo).map((p) => {
                      const selected = entry.scramble[teeKey] === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`${styles.driveBtn} ${selected ? styles.driveOn : ""}`}
                          aria-pressed={selected}
                          onClick={() => {
                            touch();
                            setEntry((e) => ({ ...e, scramble: { ...e.scramble, [teeKey]: selected ? null : p.id } }));
                          }}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canScore && !isScramble && (
        <div className={styles.entry}>
          {[duoA, duoB].map((duo) => {
            const counting = countingPlayerIds(
              Object.fromEntries(duoPlayers(duo).map((p) => [p.id, entry.bestBall[p.id]?.pickedUp ? null : entry.bestBall[p.id]?.strokes ?? null])),
            );
            const duoCount = duo.side === "A" ? bestBallCounts.a : bestBallCounts.b;
            return (
              <Card key={duo.id} edge={duo.side === "A" ? "north" : "south"}>
                <div className={styles.entryDuo}>
                  <div className={`${styles.entryTitle} ${duo.side === "A" ? styles.north : styles.south}`}>{duo.teamName}</div>
                  {duoPlayers(duo).map((p) => {
                    const e = entry.bestBall[p.id] ?? { strokes: par, pickedUp: false };
                    const isCounting = !e.pickedUp && counting.includes(p.id);
                    return (
                      <div key={p.id} className={`${styles.playerRow} ${isCounting ? styles.counting : ""}`}>
                        <div className={styles.playerName}>
                          {p.name}
                          {isCounting && <span className={styles.countTag}>counts</span>}
                        </div>
                        <ScoreStepper
                          value={e.strokes}
                          disabled={e.pickedUp}
                          onChange={(v) => {
                            touch();
                            setEntry((cur) => ({ ...cur, bestBall: { ...cur.bestBall, [p.id]: { strokes: v, pickedUp: false } } }));
                          }}
                          label={`${p.name} score`}
                        />
                        <button
                          type="button"
                          className={`${styles.pickupBtn} ${e.pickedUp ? styles.pickupOn : ""}`}
                          aria-pressed={e.pickedUp}
                          onClick={() => {
                            touch();
                            setEntry((cur) => ({ ...cur, bestBall: { ...cur.bestBall, [p.id]: { strokes: e.strokes, pickedUp: !e.pickedUp } } }));
                          }}
                        >
                          {e.pickedUp ? "Picked up ✓" : "Picked up"}
                        </button>
                      </div>
                    );
                  })}
                  <div className={styles.duoCount}>
                    {duoCount === null ? (
                      <span className={styles.capWarn}>Needs at least one score</span>
                    ) : (
                      <>
                        Duo score <b>{duoCount}</b>
                        {duoCount > max && <span className={styles.cap}> · counts as {cappedStrokes(duoCount, par)} (mercy cap)</span>}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canScore && (
        <div className={styles.postArea}>
          <button type="button" className={styles.postBtn} onClick={postHole} disabled={save === "saving" || !canPost}>
            {save === "saving" ? "Saving…" : isPosted ? `Save hole ${hole}` : `Post hole ${hole}`}
          </button>
          {save === "error" && (
            <button type="button" className={styles.retry} onClick={postHole}>
              Not saved — tap to retry{saveError ? ` (${saveError})` : ""}
            </button>
          )}
        </div>
      )}

      {/* ---------------- reverse mulligan ---------------- */}
      {canScore && (
        <Card>
          <div className={styles.rm}>
            <div className={styles.rmTitle}>Reverse mulligan</div>
            {([
              ["A", duoA, duoB],
              ["B", duoB, duoA],
            ] as const).map(([side, calling, opposing]) => {
              const status = reverseMulliganStatus(rmEvents, calling.id, round.id);
              const confirming = rmConfirm === side;
              return (
                <div key={side} className={styles.rmRow}>
                  {!status.available ? (
                    <button type="button" className={styles.rmBtn} disabled>
                      {calling.teamName.split(" ")[0]} · Used · hole {status.usedOnHole}
                    </button>
                  ) : confirming ? (
                    <div className={styles.rmConfirm}>
                      <div className={styles.rmConfirmText}>
                        {calling.teamName.split(" ")[0]} calls a reverse mulligan on {duoLabel(opposing)} at hole {hole}? One per duo per round.
                      </div>
                      <div className={styles.rmConfirmBtns}>
                        <button type="button" className={styles.rmGo} onClick={() => callMulligan(side)}>
                          Yes, call it
                        </button>
                        <button type="button" className={styles.rmCancel} onClick={() => setRmConfirm(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={styles.rmBtn} onClick={() => setRmConfirm(side)}>
                      {calling.teamName.split(" ")[0]}: call reverse mulligan on {duoLabel(opposing)}
                    </button>
                  )}
                </div>
              );
            })}
            {rmError && <div className={styles.capWarn}>{rmError}</div>}
          </div>
        </Card>
      )}

      {/* ---------------- scorecard view (collapsed by default) ---------------- */}
      <details className={styles.card}>
        <summary className={styles.cardSummary}>Scorecard</summary>
        <div className={styles.strip} role="list">
          {tiles.map((t) => (
            <button
              key={t.hole}
              type="button"
              role="listitem"
              className={`${styles.tile} ${styles[`tile_${t.tone}`]} ${t.hole === hole ? styles.tileCurrent : ""}`}
              onClick={() => goToHole(t.hole)}
              aria-label={`Hole ${t.hole}`}
            >
              <span className={styles.tileHole}>{t.hole}</span>
              <span className={styles.tileResult}>{t.label}</span>
            </button>
          ))}
        </div>
        <div className={styles.totals}>
          {(
            [
              ["Front 9", matchState.front9],
              ["Back 9", matchState.back9],
              ["Overall 18", matchState.overall18],
            ] as const
          ).map(([label, seg]) => (
            <div key={label} className={styles.totalRow}>
              <span>{label}</span>
              <span>{segmentLabel(seg).text}</span>
              <span>
                {formatPoints(seg.points.a)} – {formatPoints(seg.points.b)}
              </span>
            </div>
          ))}
        </div>
        <div className={styles.tally}>
          <div className={styles.tallyTitle}>{isScramble ? "Drives Used" : "Gross totals (bragging rights only)"}</div>
          {allPlayers.map((p) => (
            <div key={p.id} className={styles.totalRow}>
              <span>{p.name}</span>
              <span>{isScramble ? (driveTally[p.id] ?? 0) : (grossTotals[p.id] ?? "—")}</span>
            </div>
          ))}
        </div>
      </details>

      {me.isTest && (
        <form action={exitQa} className={styles.qaBar}>
          <span>QA sandbox — signed in as {me.name}</span>
          <button type="submit" className={styles.exitQa}>
            Exit QA
          </button>
        </form>
      )}
    </main>
  );
}

/** Big, controlled − / + stepper. Typing is optional; the buttons are the main path. */
function ScoreStepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className={`${styles.stepper} ${disabled ? styles.stepperOff : ""}`} role="group" aria-label={label}>
      <button type="button" className={styles.stepBtn} disabled={disabled || value <= MIN_STROKES} onClick={() => onChange(value - 1)} aria-label={`${label} minus`}>
        −
      </button>
      <input
        className={styles.stepValue}
        inputMode="numeric"
        pattern="[0-9]*"
        value={disabled ? "—" : value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n) && n >= MIN_STROKES && n <= MAX_STROKES) onChange(n);
        }}
      />
      <button type="button" className={styles.stepBtn} disabled={disabled || value >= MAX_STROKES} onClick={() => onChange(value + 1)} aria-label={`${label} plus`}>
        +
      </button>
    </div>
  );
}
