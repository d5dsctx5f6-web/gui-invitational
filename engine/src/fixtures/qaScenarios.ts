// Brief 34 Part E: the six QA full-trip scenarios. Each match is a compact HOLE-RESULT SCRIPT, one
// character per hole in order: "A" = North wins the hole, "B" = South wins it, "H" = halved. A
// script shorter than 18 characters is a match in progress; "" is a match whose duos exist but
// hasn't started; null means that slot has no match at all (a short-handed round).
//
// The scripts expand into real scores (scramble: one number per duo; best ball: two balls per duo)
// so Admin -> QA sandbox -> Load scenario writes the same data the tests pin. The EXPECTED Cup result
// for every scenario was derived by hand from these scripts (sweep = 3-0, halved match = 1.5-1.5,
// "BBBBBHHHH"x2 = a 3-0 win with only 10 holes won) — not copied from the engine's output.

export type MatchScript = string | null;

export interface ScenarioExpected {
  official: { a: number; b: number };
  holesWon: { a: number; b: number };
  possiblePoints: number;
  pointsToWin: number;
  clinched: "A" | "B" | null;
  final: boolean;
  chipOffRequired: boolean;
  winner: "A" | "B" | null;
  leaderBasis: "points" | "holes" | null;
  banner: "pairings_pending" | "chip_off_required" | "chip_off_recorded" | "shortened" | null;
  countedRoundNumbers: number[];
  projectedTotal?: { a: number; b: number };
}

export interface QaScenario {
  id: 1 | 2 | 3 | 4 | 5 | 6;
  name: string;
  /** Round 1 (Saturday) and Round 2 (Sunday): four slots each, in slot order. */
  rounds: [MatchScript[], MatchScript[]];
  eventShortened: boolean;
  expected: ScenarioExpected;
}

const SWEEP_A = "A".repeat(18);
const SWEEP_B = "B".repeat(18);
const HALVED = "H".repeat(18);
/** A 3-0 South win in which South only wins 10 holes (the other 8 are halved). */
const THIN_B = "BBBBBHHHH" + "BBBBBHHHH";

export const QA_SCENARIOS: QaScenario[] = [
  {
    id: 1,
    name: "Normal finish — North wins outright",
    rounds: [
      [SWEEP_A, SWEEP_A, HALVED, SWEEP_B],
      [SWEEP_A, SWEEP_A, HALVED, SWEEP_B],
    ],
    eventShortened: false,
    expected: {
      official: { a: 15, b: 9 },
      holesWon: { a: 72, b: 36 },
      possiblePoints: 24,
      pointsToWin: 12.5,
      clinched: "A",
      final: true,
      chipOffRequired: false,
      winner: "A",
      leaderBasis: "points",
      banner: null,
      countedRoundNumbers: [1, 2],
    },
  },
  {
    id: 2,
    name: "12–12 tie — North wins on total holes won",
    rounds: [
      [SWEEP_A, THIN_B, HALVED, HALVED],
      [SWEEP_A, THIN_B, HALVED, HALVED],
    ],
    eventShortened: false,
    expected: {
      official: { a: 12, b: 12 },
      holesWon: { a: 36, b: 20 },
      possiblePoints: 24,
      pointsToWin: 12.5,
      clinched: null,
      final: true,
      chipOffRequired: false,
      winner: "A",
      leaderBasis: "holes",
      banner: null,
      countedRoundNumbers: [1, 2],
    },
  },
  {
    id: 3,
    name: "Dead level — chip-off required",
    rounds: [
      [SWEEP_A, SWEEP_B, HALVED, HALVED],
      [SWEEP_A, SWEEP_B, HALVED, HALVED],
    ],
    eventShortened: false,
    expected: {
      official: { a: 12, b: 12 },
      holesWon: { a: 36, b: 36 },
      possiblePoints: 24,
      pointsToWin: 12.5,
      clinched: null,
      final: true,
      chipOffRequired: true,
      winner: null,
      leaderBasis: null,
      banner: "chip_off_required",
      countedRoundNumbers: [1, 2],
    },
  },
  {
    id: 4,
    name: "Shortened event — Saturday complete, Sunday partial (declared)",
    rounds: [
      [SWEEP_A, SWEEP_A, SWEEP_B, HALVED],
      ["AAAAAA", "", "", ""],
    ],
    eventShortened: true,
    expected: {
      official: { a: 7.5, b: 4.5 },
      holesWon: { a: 36, b: 18 },
      possiblePoints: 12,
      pointsToWin: 6.5,
      clinched: "A",
      final: true,
      chipOffRequired: false,
      winner: "A",
      leaderBasis: "points",
      banner: "shortened",
      countedRoundNumbers: [1],
    },
  },
  {
    id: 5,
    name: "Short-handed — Sunday has three matches (21 possible points)",
    rounds: [
      [SWEEP_A, SWEEP_B, HALVED, HALVED],
      [SWEEP_A, HALVED, HALVED, null],
    ],
    eventShortened: false,
    expected: {
      official: { a: 12, b: 9 },
      holesWon: { a: 36, b: 18 },
      possiblePoints: 21,
      pointsToWin: 11,
      clinched: "A",
      final: true,
      chipOffRequired: false,
      winner: "A",
      leaderBasis: "points",
      banner: null,
      countedRoundNumbers: [1, 2],
    },
  },
  {
    id: 6,
    name: "Mid-round live — Saturday done, Sunday in progress",
    rounds: [
      [SWEEP_A, SWEEP_B, HALVED, SWEEP_A],
      ["AAAAAAA", "BHB", "HHHH", ""],
    ],
    eventShortened: false,
    expected: {
      // Official = Saturday 7.5-4.5 plus Sunday match 1's front 9 (closed after 5 wins) = N 8.5.
      official: { a: 8.5, b: 4.5 },
      // Saturday: North's two sweeps = 36, South's one = 18; Sunday so far: North 7 (match 1), South 2 (match 2).
      holesWon: { a: 36 + 7, b: 18 + 2 },
      possiblePoints: 24,
      pointsToWin: 12.5,
      clinched: null,
      final: false,
      chipOffRequired: false,
      winner: null,
      leaderBasis: "points",
      banner: null,
      countedRoundNumbers: [1, 2],
      // If it ended now: M1 overall N up (+1 N); M2 front + overall S up (+2 S); M3 front + overall
      // all square (+1 each) -> N 8.5+2 = 10.5, S 4.5+3 = 7.5.
      projectedTotal: { a: 10.5, b: 7.5 },
    },
  },
];

/** Scramble expansion: one raw score per duo per hole. Winner makes par, loser par + 1. */
export function scrambleScores(script: string, parByHole: number[]): { hole: number; a: number; b: number }[] {
  return [...script].map((c, i) => {
    const par = parByHole[i];
    return { hole: i + 1, a: c === "B" ? par + 1 : par, b: c === "A" ? par + 1 : par };
  });
}

/** Best-ball expansion: two balls per duo. Winner's best ball is par, loser's is par + 1. */
export function bestBallScores(
  script: string,
  parByHole: number[],
): { hole: number; a: [number, number]; b: [number, number] }[] {
  return [...script].map((c, i) => {
    const par = parByHole[i];
    const win: [number, number] = [par, par + 1];
    const lose: [number, number] = [par + 1, par + 2];
    return { hole: i + 1, a: c === "B" ? lose : win, b: c === "A" ? lose : win };
  });
}

/** Round 1 pairs consecutive players; round 2 reshuffles (duos aren't fixed across the weekend).
 *  Indices are 1-8 within a team: slot k of round r -> [player1, player2]. */
export function qaTripPairing(roundNumber: 1 | 2, slot: number): [number, number] {
  return roundNumber === 1 ? [2 * slot - 1, 2 * slot] : [slot, slot + 4];
}
