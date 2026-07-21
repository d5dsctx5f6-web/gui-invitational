// The Brief 5 / M2 audit fixture: one hand-constructed "Year One" trip — 16 real
// roster players, 4 teams, 2 courses, both rounds. Shared by fullTrip.test.ts (the
// M2 gate suite) and the Part F audit script, so the printed audit and the asserted
// suite are always the exact same data.
//
// Design: every player shoots exactly gross par on every hole by default. A small,
// documented set of overrides creates the trip's plot points (a reverse mulligan, a
// skins carryover chain, a non-entrant invisibility case, an engineered standings
// tie). Nothing here is hand-computed and hardcoded — dots, match state, standings,
// skins, and individual net are all derived from this raw score table by the real
// engine functions.

import { computeEarnedPairings, type EarnedPairingsResult } from "../pairings";
import { DEFAULT_ALLOWANCE } from "../config";
import { courseHandicap, playingHandicap, strokesForHoles, type TeeSetup } from "../handicap";
import {
  computeIndividualRace,
  type IndividualRaceResult,
  type PlayerHoleNet,
} from "../individualRace";
import {
  computeMatchState,
  countHolesWon,
  type DuoHoleNets,
  type MatchState,
} from "../matchState";
import { matchScore, netScore, realScore, type HoleScore } from "../netScore";
import { computeSkins, type SkinsHoleScore, type SkinsResult } from "../skins";
import { rankTeams, type TeamMatchOutcome, type TeamRanking } from "../standings";

export type RoundId = "SAT" | "SUN";

export const PLAYERS: Record<string, number> = {
  "Chris Deliso": 8.0,
  "CJ Lambrecht": 14.0,
  "Spencer Petersen": 20.0,
  "Will Petersen": 4.0,
  "Matt Lacko": 11.0,
  "Zac Jones": 17.0,
  "Matt Hornbecker": 6.0,
  "Andrew Sabia": 22.0,
  "Brendan Gleason": 9.0,
  "Ian Hastings": 15.0,
  "Ben Meier": 3.0,
  "Tucker Gill": 19.0,
  "Cam Delaney": 12.0,
  "Dominic Ikeler": 7.0,
  "Grant Brogan": 21.0,
  "Rory Makohin": 5.0,
};

export interface CourseSetup extends TeeSetup {
  strokeIndex: number[];
  parByHole: number[];
}

/** Saturday — shamble. */
export const COURSE_A: CourseSetup = {
  rating: 70.2,
  slope: 125,
  par: 72,
  strokeIndex: [5, 11, 1, 15, 7, 13, 3, 17, 9, 6, 12, 2, 16, 8, 14, 4, 18, 10],
  parByHole: [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4],
};

/** Sunday — four-ball. A different course, to exercise per-course conversion. */
export const COURSE_B: CourseSetup = {
  rating: 73.5,
  slope: 132,
  par: 72,
  strokeIndex: [9, 3, 15, 1, 11, 5, 17, 7, 13, 10, 4, 16, 2, 12, 6, 18, 8, 14],
  parByHole: [4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4, 4],
};

function courseFor(round: RoundId): CourseSetup {
  return round === "SAT" ? COURSE_A : COURSE_B;
}

export const TEAMS: Record<string, string[]> = {
  T1: ["Chris Deliso", "CJ Lambrecht", "Spencer Petersen", "Will Petersen"],
  T2: ["Matt Lacko", "Zac Jones", "Matt Hornbecker", "Andrew Sabia"],
  T3: ["Brendan Gleason", "Ian Hastings", "Ben Meier", "Tucker Gill"],
  T4: ["Cam Delaney", "Dominic Ikeler", "Grant Brogan", "Rory Makohin"],
};
export const TEAM_IDS = Object.keys(TEAMS);

export interface Duo {
  A: string[];
  B: string[];
}

export const SAT_DUOS: Record<string, Duo> = {
  T1: { A: ["Chris Deliso", "CJ Lambrecht"], B: ["Spencer Petersen", "Will Petersen"] },
  T2: { A: ["Matt Lacko", "Zac Jones"], B: ["Matt Hornbecker", "Andrew Sabia"] },
  T3: { A: ["Brendan Gleason", "Ian Hastings"], B: ["Ben Meier", "Tucker Gill"] },
  T4: { A: ["Cam Delaney", "Dominic Ikeler"], B: ["Grant Brogan", "Rory Makohin"] },
};

/** Duos reshuffled Sunday, to prove that path (SPEC §2: captains may reshuffle between rounds). */
export const SUN_DUOS: Record<string, Duo> = {
  T1: { A: ["Chris Deliso", "Will Petersen"], B: ["CJ Lambrecht", "Spencer Petersen"] },
  T2: { A: ["Matt Lacko", "Matt Hornbecker"], B: ["Zac Jones", "Andrew Sabia"] },
  T3: { A: ["Brendan Gleason", "Ben Meier"], B: ["Ian Hastings", "Tucker Gill"] },
  T4: { A: ["Cam Delaney", "Grant Brogan"], B: ["Dominic Ikeler", "Rory Makohin"] },
};

export interface MatchFixture {
  name: string;
  round: RoundId;
  teamAId: string;
  teamBId: string;
  slot: "A" | "B";
  duoA: string[];
  duoB: string[];
}

export const SAT_MATCHES: MatchFixture[] = [
  { name: "S-A", round: "SAT", teamAId: "T1", teamBId: "T2", slot: "A", duoA: SAT_DUOS.T1.A, duoB: SAT_DUOS.T2.A },
  { name: "S-B", round: "SAT", teamAId: "T1", teamBId: "T2", slot: "B", duoA: SAT_DUOS.T1.B, duoB: SAT_DUOS.T2.B },
  { name: "S-C", round: "SAT", teamAId: "T3", teamBId: "T4", slot: "A", duoA: SAT_DUOS.T3.A, duoB: SAT_DUOS.T4.A },
  { name: "S-D", round: "SAT", teamAId: "T3", teamBId: "T4", slot: "B", duoA: SAT_DUOS.T3.B, duoB: SAT_DUOS.T4.B },
];

/**
 * Earned from the Saturday-only standings: 1st (T2) v 2nd (T3), 3rd (T4) v 4th (T1).
 * The shortened-event test proves this exact seeding falls out of Saturday alone.
 */
export const SUN_MATCHES: MatchFixture[] = [
  { name: "Su-A", round: "SUN", teamAId: "T2", teamBId: "T3", slot: "A", duoA: SUN_DUOS.T2.A, duoB: SUN_DUOS.T3.A },
  { name: "Su-B", round: "SUN", teamAId: "T2", teamBId: "T3", slot: "B", duoA: SUN_DUOS.T2.B, duoB: SUN_DUOS.T3.B },
  { name: "Su-C", round: "SUN", teamAId: "T4", teamBId: "T1", slot: "A", duoA: SUN_DUOS.T4.A, duoB: SUN_DUOS.T1.A },
  { name: "Su-D", round: "SUN", teamAId: "T4", teamBId: "T1", slot: "B", duoA: SUN_DUOS.T4.B, duoB: SUN_DUOS.T1.B },
];

export const ALL_MATCHES: MatchFixture[] = [...SAT_MATCHES, ...SUN_MATCHES];

// ---------------------------------------------------------------------------
// Raw hole_scores — the single source of truth. Baseline: everyone shoots gross
// par on every hole. Deliberate, documented overrides create the plot points.
// ---------------------------------------------------------------------------

const GROSS_OVERRIDES: Record<string, number> = {
  // Reverse mulligan: Chris holes his approach for eagle; the opposing team forces a
  // replay that goes badly. Real score (2) stands for skins/individual; the match sees
  // the replay (5). CJ is already Duo A's controlling ball on hole 10 regardless, so
  // this changes nothing about match S-A's outcome — only creates the divergence.
  "SAT|Chris Deliso|10": 2,
  // Skins carryover resolution: Will birdies hole 4, breaking a 4-hole carry (1-4).
  "SAT|Will Petersen|4": COURSE_A.parByHole[3] - 1,
  // Non-entrant invisibility: Zac's eagle is numerically lower than Will's birdie, but
  // Zac isn't a skins entrant this round — it must not win.
  "SAT|Zac Jones|4": COURSE_A.parByHole[3] - 2,
};

const MATCH_STROKES_OVERRIDES: Record<string, number> = {
  "SAT|Chris Deliso|10": 5, // the reverse-mulligan replay result
};

/**
 * Engineered standings tie: Spencer and CJ (Team 1, Sunday Duo B) both bogey these 11
 * holes instead of parring them. This trims Team 1's holes-won just enough that,
 * combined with Team 1 and Team 3 never playing each other, the two end up dead level
 * on points AND holes won after both rounds — a genuine chip-off, not a coincidence.
 * (Team 1 still wins the match 3-0 either way — the segments were decided by enough
 * margin that converting some outright wins to halves doesn't flip any of them.)
 */
const CHIP_OFF_HOLES = [3, 4, 5, 6, 7, 8, 9, 12, 14, 15, 18];
for (const hole of CHIP_OFF_HOLES) {
  GROSS_OVERRIDES[`SUN|Spencer Petersen|${hole}`] = COURSE_B.parByHole[hole - 1] + 1;
  GROSS_OVERRIDES[`SUN|CJ Lambrecht|${hole}`] = COURSE_B.parByHole[hole - 1] + 1;
}

function grossFor(name: string, round: RoundId, hole: number): number {
  const override = GROSS_OVERRIDES[`${round}|${name}|${hole}`];
  return override ?? courseFor(round).parByHole[hole - 1];
}

function matchStrokesFor(name: string, round: RoundId, hole: number): number | null {
  return MATCH_STROKES_OVERRIDES[`${round}|${name}|${hole}`] ?? null;
}

export interface HoleScoreRow {
  playerId: string;
  roundId: RoundId;
  hole: number;
  strokes: number;
  matchStrokes: number | null;
  breakfastBall: boolean;
  mulligan: boolean;
}

export const ALL_HOLE_SCORES: HoleScoreRow[] = [];
for (const name of Object.keys(PLAYERS)) {
  for (const round of ["SAT", "SUN"] as RoundId[]) {
    for (let hole = 1; hole <= 18; hole++) {
      ALL_HOLE_SCORES.push({
        playerId: name,
        roundId: round,
        hole,
        strokes: grossFor(name, round, hole),
        matchStrokes: matchStrokesFor(name, round, hole),
        // Do-over demo: Will's skins-winning birdie on hole 4 is the result of his one
        // mulligan; his breakfast ball goes unused on hole 1. Both flags are tracked
        // alongside the score — the counted `strokes` value is already the post-do-over
        // result, per Brief 3's design (no separate second-score capture for do-overs).
        breakfastBall: false,
        mulligan: round === "SAT" && name === "Will Petersen" && hole === 4,
      });
    }
  }
}

function scoreRow(name: string, round: RoundId, hole: number): HoleScoreRow {
  const row = ALL_HOLE_SCORES.find(
    (r) => r.playerId === name && r.roundId === round && r.hole === hole,
  );
  if (!row) throw new Error(`Missing fixture score for ${name} ${round} hole ${hole}`);
  return row;
}

// ---------------------------------------------------------------------------
// Derived: per-player dots, via the real engine functions (Brief 2 handicap
// pipeline, Brief 5 allowance config — 100% per Addendum A).
// ---------------------------------------------------------------------------

export const ALLOWANCE = DEFAULT_ALLOWANCE.default;

const DOTS_CACHE = new Map<string, number[]>();
export function dots(name: string, round: RoundId): number[] {
  const key = `${round}|${name}`;
  if (!DOTS_CACHE.has(key)) {
    const course = courseFor(round);
    const handicap = courseHandicap(PLAYERS[name], course);
    const playing = playingHandicap(handicap, ALLOWANCE);
    DOTS_CACHE.set(key, strokesForHoles(playing, course.strokeIndex));
  }
  return DOTS_CACHE.get(key)!;
}

function toHoleScore(row: HoleScoreRow): HoleScore {
  return { strokes: row.strokes, matchStrokes: row.matchStrokes };
}

function matchNet(name: string, round: RoundId, hole: number): number {
  const row = scoreRow(name, round, hole);
  return netScore(matchScore(toHoleScore(row)), dots(name, round)[hole - 1]);
}

function realNet(name: string, round: RoundId, hole: number): number {
  const row = scoreRow(name, round, hole);
  return netScore(realScore(toHoleScore(row)), dots(name, round)[hole - 1]);
}

export function matchHoles(match: MatchFixture): DuoHoleNets[] {
  return Array.from({ length: 18 }, (_, i) => {
    const hole = i + 1;
    return {
      hole,
      duoANet: match.duoA.map((name) => matchNet(name, match.round, hole)),
      duoBNet: match.duoB.map((name) => matchNet(name, match.round, hole)),
    };
  });
}

export interface ComputedMatch {
  fixture: MatchFixture;
  state: MatchState;
  holesWon: { a: number; b: number };
}

export const COMPUTED_MATCHES: ComputedMatch[] = ALL_MATCHES.map((fixture) => {
  const holes = matchHoles(fixture);
  return { fixture, state: computeMatchState(holes), holesWon: countHolesWon(holes) };
});

export function computedMatch(name: string): ComputedMatch {
  const found = COMPUTED_MATCHES.find((m) => m.fixture.name === name);
  if (!found) throw new Error(`No such match: ${name}`);
  return found;
}

export const SATURDAY_MATCHES = COMPUTED_MATCHES.filter((m) => m.fixture.round === "SAT");
export const SUNDAY_MATCHES = COMPUTED_MATCHES.filter((m) => m.fixture.round === "SUN");

// ---------------------------------------------------------------------------
// Team standings, cup, earned pairings
// ---------------------------------------------------------------------------

export function teamOutcomes(matches: ComputedMatch[]): TeamMatchOutcome[] {
  return matches.map((m) => ({
    teamAId: m.fixture.teamAId,
    teamBId: m.fixture.teamBId,
    points: m.state.totalPoints,
    holesWon: m.holesWon,
  }));
}

export const SATURDAY_RANKING: TeamRanking = rankTeams(TEAM_IDS, teamOutcomes(SATURDAY_MATCHES));
export const FULL_TRIP_RANKING: TeamRanking = rankTeams(TEAM_IDS, teamOutcomes(COMPUTED_MATCHES));
export const EARNED_PAIRINGS: EarnedPairingsResult = computeEarnedPairings(SATURDAY_RANKING);

// ---------------------------------------------------------------------------
// Individual race — reads realScore, never matchScore (RM-proof).
// ---------------------------------------------------------------------------

export function individualEntries(): PlayerHoleNet[] {
  const entries: PlayerHoleNet[] = [];
  for (const name of Object.keys(PLAYERS)) {
    for (const round of ["SAT", "SUN"] as RoundId[]) {
      for (let hole = 1; hole <= 18; hole++) {
        entries.push({ playerId: name, roundId: round, hole, net: realNet(name, round, hole) });
      }
    }
  }
  return entries;
}

export const INDIVIDUAL_RACE: IndividualRaceResult = computeIndividualRace(individualEntries());

// ---------------------------------------------------------------------------
// Skins — gross, opt-in, paid nightly (independent pool per round).
// ---------------------------------------------------------------------------

export const SATURDAY_NON_ENTRANTS = ["Zac Jones", "Andrew Sabia", "Grant Brogan", "Tucker Gill"];
export const SATURDAY_ENTRANTS = Object.keys(PLAYERS).filter(
  (n) => !SATURDAY_NON_ENTRANTS.includes(n),
);
export const SUNDAY_ENTRANTS = Object.keys(PLAYERS);

function skinsScoresFor(round: RoundId): SkinsHoleScore[] {
  return Object.keys(PLAYERS).flatMap((name) =>
    Array.from({ length: 18 }, (_, i) => {
      const hole = i + 1;
      return { playerId: name, hole, strokes: realScore(toHoleScore(scoreRow(name, round, hole))) };
    }),
  );
}

export const SATURDAY_SKINS: SkinsResult = computeSkins(skinsScoresFor("SAT"), SATURDAY_ENTRANTS);
export const SUNDAY_SKINS: SkinsResult = computeSkins(skinsScoresFor("SUN"), SUNDAY_ENTRANTS);
