// Brief 31's gate fixture: one hand-constructed simulated round — North Hedges vs South
// Hedges, 8v8, four duo-vs-duo scramble matches — proving F9/B9/18 match state, the
// double-bogey mercy cap, a reverse mulligan resolving to a single score, and two-team
// standings all compute correctly together from one raw duo-scoped score table. Shared by
// fullTrip.test.ts, the Brief 31 gate suite.
//
// Design, same discipline as the old v1.0 fixture it replaces: every duo shoots gross par on
// every hole by default (flat par-4 course, for tractability — par variance itself is already
// proven independently in mercyCap.test.ts). A small, documented set of overrides creates the
// plot points below. Nothing is hand-computed and hardcoded — match state, holes won, and
// standings are all derived from this raw score table by the real engine functions.

import {
  computeMatchState,
  countHolesWon,
  type DuoHoleScore,
  type MatchState,
} from "../matchState";
import { drivesUsedTally, type DrivesUsedEntry } from "../drivesUsed";
import { reverseMulliganStatus, type ReverseMulliganEvent } from "../reverseMulligan";
import { rankTeams, type TeamMatchOutcome, type TeamRanking } from "../standings";

export type RoundId = "SAT";
export type TeamId = "North" | "South";

export const NORTH_PLAYERS = [
  "Chris Deliso",
  "CJ Lambrecht",
  "Spencer Petersen",
  "Will Petersen",
  "Matt Lacko",
  "Zac Jones",
  "Matt Hornbecker",
  "Andrew Sabia",
];

export const SOUTH_PLAYERS = [
  "Brendan Gleason",
  "Ian Hastings",
  "Ben Meier",
  "Tucker Gill",
  "Cam Delaney",
  "Dominic Ikeler",
  "Grant Brogan",
  "Rory Makohin",
];

export const ALL_PLAYERS = [...NORTH_PLAYERS, ...SOUTH_PLAYERS];

export interface DuoFixture {
  id: string;
  teamId: TeamId;
  matchSlot: 1 | 2 | 3 | 4;
  players: string[];
}

export const DUOS: DuoFixture[] = [
  { id: "N1", teamId: "North", matchSlot: 1, players: [NORTH_PLAYERS[0], NORTH_PLAYERS[1]] },
  { id: "N2", teamId: "North", matchSlot: 2, players: [NORTH_PLAYERS[2], NORTH_PLAYERS[3]] },
  { id: "N3", teamId: "North", matchSlot: 3, players: [NORTH_PLAYERS[4], NORTH_PLAYERS[5]] },
  { id: "N4", teamId: "North", matchSlot: 4, players: [NORTH_PLAYERS[6], NORTH_PLAYERS[7]] },
  { id: "S1", teamId: "South", matchSlot: 1, players: [SOUTH_PLAYERS[0], SOUTH_PLAYERS[1]] },
  { id: "S2", teamId: "South", matchSlot: 2, players: [SOUTH_PLAYERS[2], SOUTH_PLAYERS[3]] },
  { id: "S3", teamId: "South", matchSlot: 3, players: [SOUTH_PLAYERS[4], SOUTH_PLAYERS[5]] },
  { id: "S4", teamId: "South", matchSlot: 4, players: [SOUTH_PLAYERS[6], SOUTH_PLAYERS[7]] },
];

export interface MatchFixture {
  slot: 1 | 2 | 3 | 4;
  northDuoId: string;
  southDuoId: string;
}

export const MATCHES: MatchFixture[] = [1, 2, 3, 4].map((slot) => ({
  slot: slot as 1 | 2 | 3 | 4,
  northDuoId: `N${slot}`,
  southDuoId: `S${slot}`,
}));

export const PAR = 4; // flat par-4 course — par variance is proven independently elsewhere

// ---------------------------------------------------------------------------
// Raw hole_scores — one row per duo per hole, the single source of truth.
// Baseline: every duo shoots gross par. Deliberate, documented overrides create the trip's
// plot points.
// ---------------------------------------------------------------------------

const STROKES_OVERRIDES: Record<string, number> = {
  // Match 1 (N1 v S1): North wins holes 1-3 outright (birdies) — a clean, decisive win with
  // the rest of the round halved, to prove a full 18-hole F9/B9/18 computation end to end.
  "N1|1": PAR - 1,
  "N1|2": PAR - 1,
  "N1|3": PAR - 1,

  // Match 2 (N2 v S2): South wins holes 10-12 outright — the mirror case, on the back nine.
  "S2|10": PAR - 1,
  "S2|11": PAR - 1,
  "S2|12": PAR - 1,

  // Match 3 (N3 v S3): mercy cap plot point. North's duo blows up to a raw 9 on hole 5 (par
  // 4) — an uncapped 9 would lose the hole outright to South's 6. Capped at par+2 (=6), the
  // hole is dead even instead: min(9,6)=6 vs min(6,6)=6 -> halved. The cap is what saves this
  // hole, not a coincidence of the numbers.
  "N3|5": PAR + 5,
  "S3|5": PAR + 2,

  // Match 4 (N4 v S4): reverse mulligan plot point. North calls RM on hole 8, forcing South's
  // duo to replay their shot — the ONLY number ever recorded is the replay result (PRODUCT_SPEC_V2
  // §2: "whatever the duo makes on the replay is the score," no divergent original captured).
  // South's posted result is worse than the baseline par, which is what wins North the hole.
  "S4|8": PAR + 1,
};

function strokesFor(duoId: string, hole: number): number {
  return STROKES_OVERRIDES[`${duoId}|${hole}`] ?? PAR;
}

export interface HoleScoreRow {
  duoId: string;
  roundId: RoundId;
  hole: number;
  strokes: number;
  /** The Drives Used tap — alternates between the duo's two players, count-agnostic if only
   *  one is on record. */
  teeShotUsedPlayerId: string | null;
}

export const ALL_HOLE_SCORES: HoleScoreRow[] = [];
for (const duo of DUOS) {
  for (let hole = 1; hole <= 18; hole++) {
    ALL_HOLE_SCORES.push({
      duoId: duo.id,
      roundId: "SAT",
      hole,
      strokes: strokesFor(duo.id, hole),
      teeShotUsedPlayerId: duo.players.length > 0 ? duo.players[hole % duo.players.length] : null,
    });
  }
}

function scoreRow(duoId: string, hole: number): HoleScoreRow {
  const row = ALL_HOLE_SCORES.find((r) => r.duoId === duoId && r.hole === hole);
  if (!row) throw new Error(`Missing fixture score for ${duoId} hole ${hole}`);
  return row;
}

// ---------------------------------------------------------------------------
// Derived: match state, holes won, standings — all via the real engine functions.
// ---------------------------------------------------------------------------

export function matchHoles(match: MatchFixture): DuoHoleScore[] {
  return Array.from({ length: 18 }, (_, i) => {
    const hole = i + 1;
    return {
      hole,
      par: PAR,
      duoAStrokes: scoreRow(match.northDuoId, hole).strokes,
      duoBStrokes: scoreRow(match.southDuoId, hole).strokes,
    };
  });
}

export interface ComputedMatch {
  fixture: MatchFixture;
  state: MatchState;
  holesWon: { a: number; b: number };
}

export const COMPUTED_MATCHES: ComputedMatch[] = MATCHES.map((fixture) => {
  const holes = matchHoles(fixture);
  return { fixture, state: computeMatchState(holes), holesWon: countHolesWon(holes) };
});

export function computedMatch(slot: 1 | 2 | 3 | 4): ComputedMatch {
  const found = COMPUTED_MATCHES.find((m) => m.fixture.slot === slot);
  if (!found) throw new Error(`No such match slot: ${slot}`);
  return found;
}

export function teamOutcomes(matches: ComputedMatch[]): TeamMatchOutcome[] {
  return matches.map((m) => ({
    teamAId: "North",
    teamBId: "South",
    points: m.state.totalPoints,
    holesWon: m.holesWon,
  }));
}

export const SATURDAY_RANKING: TeamRanking = rankTeams(
  ["North", "South"],
  teamOutcomes(COMPUTED_MATCHES),
);

// ---------------------------------------------------------------------------
// Reverse mulligan — North (N4) called it against South (S4) on hole 8.
// ---------------------------------------------------------------------------

export const RM_EVENTS: ReverseMulliganEvent[] = [{ duoId: "N4", roundId: "SAT", hole: 8 }];

export function rmStatusFor(duoId: string): ReturnType<typeof reverseMulliganStatus> {
  return reverseMulliganStatus(RM_EVENTS, duoId, "SAT");
}

// ---------------------------------------------------------------------------
// Drives Used — tallied straight from the raw hole_scores rows above.
// ---------------------------------------------------------------------------

export function drivesUsedEntries(): DrivesUsedEntry[] {
  return ALL_HOLE_SCORES.filter((r) => r.teeShotUsedPlayerId !== null).map((r) => ({
    roundId: r.roundId,
    hole: r.hole,
    playerId: r.teeShotUsedPlayerId!,
  }));
}

export const DRIVES_USED_TALLY: Record<string, number> = drivesUsedTally(drivesUsedEntries());
