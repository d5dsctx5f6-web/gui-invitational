"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import pageStyles from "../page.module.css";
import {
  computeIndividualRace,
  computeMatchState,
  countHolesWon,
  courseHandicap,
  matchScore,
  netScore,
  playingHandicap,
  rankTeams,
  realScore,
  strokesForHoles,
  type DuoHoleNets,
  type PlayerHoleNet,
  type TeamMatchOutcome,
} from "@/engine/src";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";
import styles from "./leaderboard.module.css";

export interface Round {
  id: string;
  date: string;
  default_tee_id: string | null;
}
export interface Team {
  id: string;
  name: string;
  captain_player_id: string | null;
}
export interface Player {
  id: string;
  name: string;
  index: number | null;
}
export interface Match {
  id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  slot: string;
}
export interface DuoSubmissionRow {
  round_id: string;
  team_id: string;
  duo_a_player_1: string;
  duo_a_player_2: string | null;
  duo_b_player_1: string | null;
  duo_b_player_2: string | null;
}
export interface HoleScoreRow {
  player_id: string;
  round_id: string;
  hole: number;
  strokes: number;
  match_strokes: number | null;
}
export interface CourseTeeRow {
  id: string;
  rating: number;
  slope: number;
  par: number;
  stroke_index: number[];
}

export interface Snapshot {
  rounds: Round[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  duoSubmissions: DuoSubmissionRow[];
  holeScores: HoleScoreRow[];
  courseTees: CourseTeeRow[];
}

function duoPlayerIds(
  sub: DuoSubmissionRow | undefined,
  slot: string,
): string[] {
  if (!sub) return [];
  const [p1, p2] =
    slot === "A"
      ? [sub.duo_a_player_1, sub.duo_a_player_2]
      : [sub.duo_b_player_1, sub.duo_b_player_2];
  return [p1, p2].filter((id): id is string => id !== null);
}

/**
 * Runs the whole trip's raw rows through the engine: per round, per-player dots (course
 * handicap → playing handicap → stroke allocation) from that round's tee, then per match a
 * TeamMatchOutcome (match score, RM-proof by construction via matchScore()) and per scored hole
 * a PlayerHoleNet (real score, per individualRace.ts's own rule — never the match score).
 */
function compute(snapshot: Snapshot) {
  const teeById = new Map(snapshot.courseTees.map((t) => [t.id, t]));
  const outcomes: TeamMatchOutcome[] = [];
  const individualEntries: PlayerHoleNet[] = [];

  for (const round of snapshot.rounds) {
    if (!round.default_tee_id) continue;
    const tee = teeById.get(round.default_tee_id);
    if (!tee) continue;

    const dotsByPlayer = new Map<string, number[]>();
    for (const p of snapshot.players) {
      const handicap = courseHandicap(p.index ?? 0, tee);
      dotsByPlayer.set(
        p.id,
        strokesForHoles(playingHandicap(handicap), tee.stroke_index),
      );
    }

    const roundHoleScores = snapshot.holeScores.filter(
      (h) => h.round_id === round.id,
    );

    for (const row of roundHoleScores) {
      const dots = dotsByPlayer.get(row.player_id);
      if (!dots) continue;
      individualEntries.push({
        playerId: row.player_id,
        roundId: round.id,
        hole: row.hole,
        net: netScore(realScore(row), dots[row.hole - 1]),
      });
    }

    const roundMatches = snapshot.matches.filter((m) => m.round_id === round.id);
    for (const match of roundMatches) {
      const subA = snapshot.duoSubmissions.find(
        (d) => d.round_id === round.id && d.team_id === match.team_a_id,
      );
      const subB = snapshot.duoSubmissions.find(
        (d) => d.round_id === round.id && d.team_id === match.team_b_id,
      );
      const teamAPlayerIds = duoPlayerIds(subA, match.slot);
      const teamBPlayerIds = duoPlayerIds(subB, match.slot);
      if (teamAPlayerIds.length === 0 && teamBPlayerIds.length === 0) continue;

      const holes: DuoHoleNets[] = [];
      for (let hole = 1; hole <= 18; hole++) {
        const netFor = (playerIds: string[]) =>
          playerIds
            .map((pid) => {
              const row = roundHoleScores.find(
                (h) => h.player_id === pid && h.hole === hole,
              );
              const dots = dotsByPlayer.get(pid);
              return row && dots ? netScore(matchScore(row), dots[hole - 1]) : null;
            })
            .filter((n): n is number => n !== null);
        holes.push({
          hole,
          duoANet: netFor(teamAPlayerIds),
          duoBNet: netFor(teamBPlayerIds),
        });
      }

      const state = computeMatchState(holes);
      const holesWon = countHolesWon(holes);
      outcomes.push({
        teamAId: match.team_a_id,
        teamBId: match.team_b_id,
        points: state.totalPoints,
        holesWon,
      });
    }
  }

  const ranking = rankTeams(
    snapshot.teams.map((t) => t.id),
    outcomes,
  );
  const race = computeIndividualRace(individualEntries);
  return { ranking, race };
}

async function fetchSnapshot(): Promise<Snapshot> {
  const supabase = createClient();
  const [rounds, teams, players, matches, duoSubmissions, holeScores, courseTees] =
    await Promise.all([
      supabase.from("rounds").select("id, date, default_tee_id").order("date"),
      supabase.from("teams").select("id, name, captain_player_id"),
      supabase.from("players").select("id, name, index"),
      supabase.from("matches").select("id, round_id, team_a_id, team_b_id, slot"),
      supabase
        .from("duo_submissions")
        .select("round_id, team_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2"),
      supabase
        .from("hole_scores")
        .select("player_id, round_id, hole, strokes, match_strokes"),
      supabase
        .from("course_tees")
        .select("id, rating, slope, par, stroke_index"),
    ]);

  return {
    rounds: (rounds.data ?? []) as Round[],
    teams: (teams.data ?? []) as Team[],
    players: (players.data ?? []) as Player[],
    matches: (matches.data ?? []) as Match[],
    duoSubmissions: (duoSubmissions.data ?? []) as DuoSubmissionRow[],
    holeScores: (holeScores.data ?? []) as HoleScoreRow[],
    courseTees: (courseTees.data ?? []) as CourseTeeRow[],
  };
}

function teamName(teams: Team[], id: string): string {
  return teams.find((t) => t.id === id)?.name ?? "?";
}

function captainName(teams: Team[], players: Player[], teamId: string): string {
  const captainId = teams.find((t) => t.id === teamId)?.captain_player_id;
  if (!captainId) return "no captain";
  return `Capt. ${players.find((p) => p.id === captainId)?.name ?? "?"}`;
}

function playerName(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

export function LeaderboardScreen({ initialSnapshot }: { initialSnapshot: Snapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<"cup" | "individual">("cup");

  async function refetch() {
    setSnapshot(await fetchSnapshot());
  }

  useRealtimeRefetch("hole_scores", null, refetch);
  useRealtimeRefetch("duo_submissions", null, refetch);
  useRealtimeRefetch("matches", null, refetch);

  const { ranking, race } = useMemo(() => compute(snapshot), [snapshot]);

  const totalsByTeam = new Map(ranking.totals.map((t) => [t.teamId, t]));

  return (
    <main className={styles.page}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Leaderboard · <b>most of 24 points wins</b>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${view === "cup" ? styles.tabActive : ""}`}
          onClick={() => setView("cup")}
        >
          The Cup
        </button>
        <button
          className={`${styles.tab} ${view === "individual" ? styles.tabActive : ""}`}
          onClick={() => setView("individual")}
        >
          Individual race
        </button>
      </div>

      {view === "cup" ? (
        <>
          <div className={styles.board}>
            {ranking.buckets.map((bucket) =>
              bucket.chipOffRequired ? (
                <div key={bucket.rank} className={styles.chipRow}>
                  {bucket.teamIds.map((teamId) => (
                    <div className={styles.row} key={teamId}>
                      <div className={`${styles.tile} ${styles.pos}`}>T{bucket.rank}</div>
                      <div className={`${styles.tile} ${styles.name}`}>
                        {teamName(snapshot.teams, teamId)}
                        <span className={styles.nameDetail}>
                          {captainName(snapshot.teams, snapshot.players, teamId)}
                        </span>
                      </div>
                      <div className={`${styles.tile} ${styles.pts}`}>
                        {totalsByTeam.get(teamId)?.points ?? 0}
                      </div>
                    </div>
                  ))}
                  <div className={styles.chipNote}>
                    Chip-off required: {bucket.teamIds.map((id) => teamName(snapshot.teams, id)).join(" vs ")}
                  </div>
                </div>
              ) : (
                <div className={styles.row} key={bucket.teamIds[0]}>
                  <div className={`${styles.tile} ${styles.pos}`}>{bucket.rank}</div>
                  <div className={`${styles.tile} ${styles.name}`}>
                    {teamName(snapshot.teams, bucket.teamIds[0])}
                    <span className={styles.nameDetail}>
                      {captainName(snapshot.teams, snapshot.players, bucket.teamIds[0])}
                    </span>
                  </div>
                  <div className={`${styles.tile} ${styles.pts}`}>
                    {totalsByTeam.get(bucket.teamIds[0])?.points ?? 0}
                  </div>
                </div>
              ),
            )}
          </div>
          <div className={styles.boardfoot}>
            Ties resolved by head-to-head, then holes won · anything still tied is a chip-off
          </div>
        </>
      ) : (
        <>
          <div className={styles.board}>
            {race.standings.length === 0 && (
              <div className={styles.hint}>No scores posted yet.</div>
            )}
            {race.standings.map((s, i) => {
              const isDailyLow = race.dailyLows.some((dl) => dl.playerIds.includes(s.playerId));
              return (
                <div className={styles.row} key={s.playerId}>
                  <div className={`${styles.tile} ${styles.pos}`}>{i + 1}</div>
                  <div className={`${styles.tile} ${styles.name}`}>
                    {playerName(snapshot.players, s.playerId)}
                    {isDailyLow && <span className={styles.lowBadge}>◆</span>}
                    <span className={styles.nameDetail}>thru {s.holesPlayed}</span>
                  </div>
                  <div className={`${styles.tile} ${styles.pts}`}>
                    {s.cumulativeNet > 0 ? `+${s.cumulativeNet}` : s.cumulativeNet}
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.boardfoot}>◆ daily low net · lower is better · ties shown as ties</div>
        </>
      )}
    </main>
  );
}
