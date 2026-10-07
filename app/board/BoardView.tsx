"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/engine/src";
import type { CupData } from "@/lib/cupData";
import { ThemeToggle } from "../design-preview/components/ThemeToggle";
import { deriveCupView, shortenedAfterLabel } from "../leaderboard/cupModel";
import { useCupData } from "../leaderboard/useCup";
import styles from "./Board.module.css";

const POLL_MS = 30_000;

/** The TV board: read-only, no links, no admin. Realtime + a 30s refetch fallback, with a visible clock. */
export function BoardView({ initial }: { initial: CupData }) {
  const { data, stale } = useCupData(initial, POLL_MS);
  const view = deriveCupView(data);
  const { standings, projection, headline } = view;

  // Re-render every few seconds so "updated Ns ago" stays honest and a frozen screen is obvious.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  const ageSec = Math.max(0, Math.round((now - new Date(data.loadedAt).getTime()) / 1000));
  const overdue = ageSec > POLL_MS / 1000 * 3; // missed three polls: say so loudly

  const showProjection =
    !standings.final && !standings.pairingsPending && (projection.projectedExtra.a > 0 || projection.projectedExtra.b > 0);

  return (
    <main className={styles.board}>
      <div className={styles.top}>
        <div className={styles.cup}>
          <div className={styles.scoreRow}>
            <div className={styles.team}>
              <span className={`${styles.teamName} ${styles.north}`}>North Hedges</span>
              <span className={`${styles.points} ${styles.north}`}>{formatPoints(standings.official.a)}</span>
            </div>
            <span className={styles.dash}>–</span>
            <div className={`${styles.team} ${styles.teamRight}`}>
              <span className={`${styles.teamName} ${styles.south}`}>South Hedges</span>
              <span className={`${styles.points} ${styles.south}`}>{formatPoints(standings.official.b)}</span>
            </div>
          </div>
          <div className={`${styles.line} ${styles[`line_${headline.tone}`]}`}>
            {[headline.toWin, headline.progress, headline.line].filter(Boolean).join(" · ") || "The Hedges Invitational Cup"}
          </div>
          {standings.banner === "shortened" && (
            <div className={styles.line + " " + styles.line_alert}>Shortened event — standings after {shortenedAfterLabel(view)}</div>
          )}
          {showProjection && (
            <div className={styles.projection}>
              If it ended now: <b>North {formatPoints(projection.projectedTotal.a)} – South {formatPoints(projection.projectedTotal.b)}</b>
            </div>
          )}
        </div>
        <div className={styles.side}>
          <span className={styles.brand}>The Hedges Invitational</span>
          {data.scope === "qa" && <span className={styles.qa}>QA sandbox</span>}
          <ThemeToggle />
        </div>
      </div>

      <div className={styles.rounds}>
        {!data.season || view.beforePairings ? (
          <div className={styles.empty} style={{ gridColumn: "1 / -1" }}>
            {data.season ? "Pairings Night hasn't happened yet — matches appear here once they're set." : "No season yet."}
          </div>
        ) : (
          view.rounds.map((round) => (
            <section key={round.id} className={styles.round}>
              <div>
                <div className={styles.roundTitle}>
                  {round.dayLabel} · {round.formatLabel}
                </div>
                <div className={styles.roundMeta}>
                  {round.courseName}
                  {round.possiblePoints > 0 ? ` · ${formatPoints(round.decidedPoints)} of ${round.possiblePoints} decided` : ""}
                  {!round.counts ? " · not counted (shortened)" : ""}
                </div>
              </div>
              {round.matches.length === 0 ? (
                <div className={styles.empty} style={{ flex: 1 }}>
                  Pairings not set yet
                </div>
              ) : (
                <div className={styles.matches}>
                  {round.matches.map((m) => (
                    <div key={m.slot} className={styles.match}>
                      <div className={styles.duos}>
                        <span className={`${styles.duo} ${styles.north}`}>{m.northNames}</span>
                        <span className={`${styles.duo} ${styles.south}`}>{m.southNames}</span>
                      </div>
                      <div className={styles.right}>
                        <span className={`${styles.status} ${styles[`status_${m.card.state}`] ?? ""}`}>{m.card.status}</span>
                        <div className={styles.chips}>
                          {m.segments.map((s) => (
                            <span key={s.label} className={`${styles.chip} ${styles[`tone_${s.seg.tone}`] ?? ""}`}>
                              <span className={styles.chipLabel}>{s.label}</span>
                              <span className={styles.chipText}>{s.seg.text}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </div>

      <div className={styles.footer}>
        <span>
          {stale || overdue ? (
            <span className={styles.stale}>NOT LIVE — showing the last update ({ageSec}s old)</span>
          ) : (
            <span className={styles.live}>● LIVE</span>
          )}
          {" · "}updated{" "}
          {new Date(data.loadedAt).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", second: "2-digit" })}{" "}
          AZ
        </span>
        {standings.banner === "chip_off_required" && (
          <span className={styles.banner}>CHIP-OFF REQUIRED — level on points and holes won</span>
        )}
        <span>North = blue · South = gold</span>
      </div>
    </main>
  );
}
