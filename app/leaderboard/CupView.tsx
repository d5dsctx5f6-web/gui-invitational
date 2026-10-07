"use client";

import Link from "next/link";
import { formatPoints } from "@/engine/src";
import type { CupData } from "@/lib/cupData";
import { ThemeToggle } from "../design-preview/components/ThemeToggle";
import { deriveCupView, shortenedAfterLabel, type CupView as CupViewModel, type MatchView } from "./cupModel";
import { useCupData } from "./useCup";
import styles from "./Cup.module.css";

const TEAM_WORD = { north: "North", south: "South" } as const;

export function CupHeader({ view }: { view: CupViewModel }) {
  const { standings, projection, headline } = view;
  const showProjection =
    !standings.final &&
    !standings.pairingsPending &&
    (projection.projectedExtra.a > 0 || projection.projectedExtra.b > 0);
  return (
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
      {(headline.toWin || headline.progress) && (
        <div className={styles.toWin}>{[headline.toWin, headline.progress].filter(Boolean).join(" · ")}</div>
      )}
      {headline.line && <div className={`${styles.headline} ${styles[`headline_${headline.tone}`]}`}>{headline.line}</div>}
      {standings.banner === "shortened" && (
        <div className={styles.banner}>Shortened event — standings after {shortenedAfterLabel(view)}</div>
      )}
      {showProjection && (
        <div className={styles.projection}>
          <span className={styles.projLabel}>If it ended now</span>
          <span className={styles.projValue}>
            North {formatPoints(projection.projectedTotal.a)} – South {formatPoints(projection.projectedTotal.b)}
          </span>
          <span className={styles.projNote}>A projection from live matches — not the official score.</span>
        </div>
      )}
    </div>
  );
}

export function MatchCard({ match, scope }: { match: MatchView; scope: string }) {
  const scopeQ = scope === "qa" ? "?scope=qa" : "";
  return (
    <Link
      href={`/leaderboard/match/${match.roundId}/${match.slot}${scopeQ}`}
      className={styles.card}
      aria-label={`Match ${match.slot}: ${match.northNames} versus ${match.southNames}`}
    >
      <div className={styles.cardTop}>
        <span>Match {match.slot}</span>
        <span>{match.teeTime ? `Tee ${match.teeTime}` : ""}</span>
      </div>
      <div className={styles.duos}>
        <span className={`${styles.duoName} ${styles.north}`}>
          {match.northNames}
          {match.northShortHanded && <span className={styles.shortTag}> · short-handed</span>}
        </span>
        <span className={styles.vs}>vs</span>
        <span className={`${styles.duoName} ${styles.south}`}>
          {match.southNames}
          {match.southShortHanded && <span className={styles.shortTag}> · short-handed</span>}
        </span>
      </div>
      <div className={`${styles.cardStatus} ${styles[`status_${match.card.state}`]}`}>{match.card.status}</div>
      <div className={styles.chips}>
        {match.segments.map((s) => (
          <div key={s.label} className={`${styles.chip} ${styles[`tone_${s.seg.tone}`]}`}>
            <span className={styles.chipLabel}>{s.label}</span>
            <span className={styles.chipText}>{s.seg.text}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

export function CupView({ initial }: { initial: CupData }) {
  const { data, stale } = useCupData(initial);
  const view = deriveCupView(data);
  const { standings } = view;

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.back}>
          ← Home
        </Link>
        {data.scope === "qa" && <span className={styles.qaBadge}>QA sandbox</span>}
        <ThemeToggle />
      </div>

      {!data.season ? (
        <div className={styles.empty}>No season yet.</div>
      ) : (
        <>
          <CupHeader view={view} />

          {standings.banner === "chip_off_required" && (
            <div className={styles.banner}>
              Chip-off required: points and holes won are both level. Two captains, one wedge each, on the practice
              green — the commissioner records the result.
            </div>
          )}

          {view.beforePairings && (
            <div className={styles.empty}>
              Pairings Night hasn&apos;t happened yet. Matches appear here the moment the commissioner sets them.
            </div>
          )}

          {view.rounds.map((round) => (
            <section key={round.id} className={styles.round}>
              <div className={styles.roundHead}>
                <div className={styles.roundTitle}>
                  {round.dayLabel} · {round.formatLabel}
                </div>
                <div className={styles.roundMeta}>
                  {round.courseName}
                  {round.teeName ? ` · ${round.teeName}` : ""}
                  {round.possiblePoints > 0 ? ` · ${formatPoints(round.decidedPoints)} of ${round.possiblePoints} points decided` : ""}
                </div>
                {!round.counts && (
                  <div className={styles.notCounted}>Not counted — the event was declared shortened.</div>
                )}
              </div>

              {round.matches.length === 0 && !view.beforePairings && (
                <div className={styles.empty}>This round&apos;s pairings aren&apos;t set yet.</div>
              )}
              {round.matches.map((m) => (
                <MatchCard key={m.slot} match={m} scope={data.scope} />
              ))}
              {round.unpairedSlots.length > 0 && (
                <div className={styles.empty}>
                  Match {round.unpairedSlots.join(", ")}: waiting for an opponent — it doesn&apos;t count until both
                  duos are set.
                </div>
              )}
            </section>
          ))}

          <div className={styles.updated}>
            {stale ? <span className={styles.stale}>Connection lost — showing the last update · </span> : null}
            Updated {new Date(data.loadedAt).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", second: "2-digit" })} AZ
            {" · "}
            {TEAM_WORD.north} blue, {TEAM_WORD.south} gold
          </div>
        </>
      )}
    </main>
  );
}
