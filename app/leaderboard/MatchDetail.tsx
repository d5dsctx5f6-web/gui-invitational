"use client";

import Link from "next/link";
import {
  cappedStrokes,
  drivesUsedTally,
  resolveHoleResults,
  type DuoHoleScore,
} from "@/engine/src";
import type { CupData } from "@/lib/cupData";
import { ThemeToggle } from "../design-preview/components/ThemeToggle";
import { MatchCard } from "./CupView";
import { deriveCupView, namesOf } from "./cupModel";
import { useCupData } from "./useCup";
import styles from "./Cup.module.css";

/** Read-only match detail, neutral perspective: team-colored tiles, each duo's counting score per hole. */
export function MatchDetail({ initial, roundId, slot }: { initial: CupData; roundId: string; slot: number }) {
  const { data, stale } = useCupData(initial);
  const view = deriveCupView(data);
  const round = view.rounds.find((r) => r.id === roundId);
  const match = round?.matches.find((m) => m.slot === slot);
  const roundData = data.rounds.find((r) => r.id === roundId);
  const scopeQ = data.scope === "qa" ? "?scope=qa" : "";

  const back = (
    <div className={styles.topbar}>
      <Link href={`/leaderboard${scopeQ}`} className={styles.back}>
        ← Leaderboard
      </Link>
      {data.scope === "qa" && <span className={styles.qaBadge}>QA sandbox</span>}
      <ThemeToggle />
    </div>
  );

  if (!round || !match || !roundData) {
    return (
      <main className={styles.page}>
        {back}
        <div className={styles.empty}>That match isn&apos;t set yet.</div>
      </main>
    );
  }

  const rawMatch = roundData.matches.find((m) => m.slot === slot)!;
  const holes: DuoHoleScore[] = match.holes;
  const results = resolveHoleResults(holes);
  const north = rawMatch.north!;
  const south = rawMatch.south!;

  const rm = data.mulligans.filter((m) => m.roundId === roundId && (m.duoId === north.id || m.duoId === south.id));
  const driveEntries = data.scrambleRows
    .filter((r) => r.roundId === roundId && (r.duoId === north.id || r.duoId === south.id) && r.teeShotPlayerId)
    .map((r) => ({ roundId, hole: r.hole, playerId: r.teeShotPlayerId! }));
  const tally = drivesUsedTally(driveEntries);
  const everyone = [...north.playerIds, ...south.playerIds].filter((x): x is string => !!x);
  const capped = holes.filter(
    (h) =>
      (h.duoAStrokes !== null && cappedStrokes(h.duoAStrokes, h.par) < h.duoAStrokes) ||
      (h.duoBStrokes !== null && cappedStrokes(h.duoBStrokes, h.par) < h.duoBStrokes),
  );

  return (
    <main className={styles.page}>
      {back}
      <div className={styles.roundHead}>
        <div className={styles.roundTitle}>
          {round.dayLabel} · Match {slot}
        </div>
        <div className={styles.roundMeta}>
          {round.formatLabel} · {round.courseName}
          {round.teeName ? ` · ${round.teeName}` : ""}
        </div>
      </div>

      <MatchCard match={match} scope="detail" />

      <div className={styles.sectionTitle}>Hole by hole</div>
      <div className={styles.strip}>
        {results.map((r) => {
          const h = holes[r.hole - 1];
          const tone = r.winner === null ? "none" : r.winner === "A" ? "a" : r.winner === "B" ? "b" : "h";
          const mark = r.winner === null ? "·" : r.winner === "A" ? "N" : r.winner === "B" ? "S" : "H";
          const wasCapped =
            (h.duoAStrokes !== null && cappedStrokes(h.duoAStrokes, h.par) < h.duoAStrokes) ||
            (h.duoBStrokes !== null && cappedStrokes(h.duoBStrokes, h.par) < h.duoBStrokes);
          return (
            <div key={r.hole} className={`${styles.tile} ${styles[`tile_${tone}`]}`} aria-label={`Hole ${r.hole}`}>
              <span className={styles.tileHole}>{r.hole}</span>
              <span className={styles.tileMark}>{mark}</span>
              <span className={styles.tileScores}>
                {h.duoAStrokes ?? "–"}·{h.duoBStrokes ?? "–"}
              </span>
              {wasCapped && <span className={styles.capped}>cap {h.par + 2}</span>}
            </div>
          );
        })}
      </div>
      <div className={styles.roundMeta}>
        Tiles show the duo&apos;s counting score (North · South). Blue = North won the hole, gold = South, grey = halved.
        {capped.length > 0 ? " “cap” marks a hole where the mercy cap (par + 2) changed the number that counts." : ""}
      </div>

      <div className={styles.sectionTitle}>Reverse mulligan calls</div>
      {rm.length === 0 ? (
        <div className={styles.roundMeta}>None called in this match.</div>
      ) : (
        <div className={styles.list}>
          {rm.map((m) => (
            <div key={m.id} className={styles.listRow}>
              <span className={m.duoId === north.id ? styles.north : styles.south}>
                {m.duoId === north.id ? "North" : "South"}: {namesOf(m.duoId === north.id ? north : south, data.playerNames)}
              </span>
              <span>hole {m.hole}</span>
            </div>
          ))}
        </div>
      )}

      {roundData.format === "scramble" && (
        <>
          <div className={styles.sectionTitle}>Drives Used</div>
          <div className={styles.list}>
            {everyone.map((id) => (
              <div key={id} className={styles.listRow}>
                <span>{data.playerNames[id] ?? "?"}</span>
                <span>{tally[id] ?? 0}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={styles.updated}>
        {stale ? <span className={styles.stale}>Connection lost — showing the last update · </span> : null}
        Read-only
      </div>
    </main>
  );
}
