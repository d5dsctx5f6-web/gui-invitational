// The Cup (Brief 34): who's winning, from the same match-state engine every other screen uses.
// There is NO second scoring path: every match is computeMatchState() over the holes the scoring
// adapter produced (scramble or best ball). Everything here is derived, nothing stored.
//
// Conventions: side "A" is North Hedges, side "B" is South Hedges (as everywhere). Possible points
// are ALWAYS matches-that-exist x 3 — never a constant (a short-handed round can have 3 matches).

import { computeMatchState, countHolesWon, type DuoHoleScore, type MatchState } from "./matchState";
import { isMatchDecided, isRoundComplete, officialRounds } from "./shortenedEvent";
import { rankTeams } from "./standings";
import { formatPoints, segmentLabel } from "./matchStatus";

export interface CupMatchInput {
  slot: number;
  holes: DuoHoleScore[]; // 18 holes, A = North, B = South, from buildMatchHoles()
}

export interface CupRoundInput {
  roundId: string;
  roundNumber: number; // Saturday = 1, Sunday = 2
  matches: CupMatchInput[];
}

export interface CupInput {
  rounds: CupRoundInput[]; // any order; sorted by roundNumber here
  /** Commissioner's explicit call (seasons.event_shortened). Never inferred. */
  eventShortened: boolean;
  /** "A" | "B" once the commissioner records the chip-off winner (seasons.chip_off_winner_team_id). */
  chipOffWinner: "A" | "B" | null;
}

export type Pts = { a: number; b: number };

export interface CupMatchResult {
  slot: number;
  state: MatchState;
  decided: boolean;
  holesWon: Pts;
}

export interface CupRoundResult {
  roundId: string;
  roundNumber: number;
  matches: CupMatchResult[];
  complete: boolean;
  /** Points decided so far (closed segments) / possible (matches x 3). */
  decidedPoints: number;
  possiblePoints: number;
  /** False when the event was declared shortened and this round is past the last complete one. */
  counts: boolean;
}

export type CupBanner = "pairings_pending" | "chip_off_required" | "chip_off_recorded" | "shortened" | null;

export interface CupStandings {
  official: Pts;
  holesWon: Pts;
  /** Matches that exist in the rounds that count, x 3. Never a constant. */
  possiblePoints: number;
  /** Points decided so far (closed segments) across the rounds that count. */
  decidedPoints: number;
  /** Smallest total that wins outright: possible / 2 + 1/2 (12.5 of 24, 11 of 21). Null with no matches
   *  or while a round is still unpaired (the true possible total isn't known yet). */
  pointsToWin: number | null;
  /** Side that has mathematically clinched (reached pointsToWin), or null. */
  clinched: "A" | "B" | null;
  /** Every round that counts has matches and all of them are decided. */
  final: boolean;
  /** Some round in the season has no duos yet (before Pairings Night). */
  pairingsPending: boolean;
  /** Ranking by points then total holes won. Null while pairings are pending / nothing to rank. */
  leader: "A" | "B" | null;
  leaderBasis: "points" | "holes" | null;
  /** Level on points AND holes won at the end and nobody recorded: the commissioner must chip off. */
  chipOffRequired: boolean;
  /** Final winner: leader, or the recorded chip-off winner. */
  winner: "A" | "B" | null;
  banner: CupBanner;
  eventShortened: boolean;
  rounds: CupRoundResult[];
  /** Round numbers that count (all of them unless shortened was declared). */
  countedRoundNumbers: number[];
}

function evaluateMatch(m: CupMatchInput): CupMatchResult {
  const state = computeMatchState(m.holes);
  return { slot: m.slot, state, decided: isMatchDecided(state), holesWon: countHolesWon(m.holes) };
}

export function cupStandings(input: CupInput): CupStandings {
  const rounds = [...input.rounds].sort((x, y) => x.roundNumber - y.roundNumber);
  const evaluated = rounds.map((r) => ({ round: r, matches: r.matches.map(evaluateMatch) }));

  const pairingsPending = evaluated.length === 0 || evaluated.some((e) => e.matches.length === 0);

  // Which rounds count: all of them, unless the commissioner declared the event shortened — then only
  // the rounds up to the last fully completed one (stopping at the first incomplete round).
  let countedIds = new Set(evaluated.map((e) => e.round.roundId));
  if (input.eventShortened) {
    const official = officialRounds(
      evaluated.map((e) => ({ roundId: e.round.roundId, complete: isRoundComplete(e.matches.map((m) => m.state)) })),
    );
    countedIds = new Set(official.roundIds);
  }

  const roundResults: CupRoundResult[] = evaluated.map((e) => {
    const decidedPoints = e.matches.reduce((s, m) => s + m.state.totalPoints.a + m.state.totalPoints.b, 0);
    return {
      roundId: e.round.roundId,
      roundNumber: e.round.roundNumber,
      matches: e.matches,
      complete: isRoundComplete(e.matches.map((m) => m.state)),
      decidedPoints,
      possiblePoints: e.matches.length * 3,
      counts: countedIds.has(e.round.roundId),
    };
  });

  const counted = roundResults.filter((r) => r.counts);
  const countedMatches = counted.flatMap((r) => r.matches);

  const official: Pts = { a: 0, b: 0 };
  const holesWon: Pts = { a: 0, b: 0 };
  for (const m of countedMatches) {
    official.a += m.state.totalPoints.a;
    official.b += m.state.totalPoints.b;
    holesWon.a += m.holesWon.a;
    holesWon.b += m.holesWon.b;
  }

  const possiblePoints = countedMatches.length * 3;
  const decidedPoints = official.a + official.b;
  // With a round still unpaired, the true possible total isn't known (Sunday could add up to 12 more),
  // so there is no target and no clinch — unless the commissioner declared the event shortened, in
  // which case only the completed rounds count and the target is known.
  const targetKnown = !pairingsPending || input.eventShortened;
  const pointsToWin = possiblePoints > 0 && targetKnown ? possiblePoints / 2 + 0.5 : null;
  const clinched: "A" | "B" | null =
    pointsToWin === null ? null : official.a >= pointsToWin ? "A" : official.b >= pointsToWin ? "B" : null;

  // "Final": at least one round counts and every counted round is complete (all matches decided).
  // A round with no matches yet is never complete, so unpaired rounds keep the event from being final.
  const final = counted.length > 0 && counted.every((r) => r.complete);

  // Rank with the existing two-team ladder: points -> total holes won -> chip-off flag.
  let leader: "A" | "B" | null = null;
  let leaderBasis: "points" | "holes" | null = null;
  let chipOffRequired = false;
  if (countedMatches.length > 0) {
    const ranking = rankTeams(
      ["A", "B"],
      countedMatches.map((m) => ({ teamAId: "A", teamBId: "B", points: m.state.totalPoints, holesWon: m.holesWon })),
    );
    const top = ranking.buckets[0];
    if (top.teamIds.length === 1) {
      leader = top.teamIds[0] as "A" | "B";
      leaderBasis = official.a !== official.b ? "points" : "holes";
    } else {
      // Level on everything. Only a "chip-off required" once the counted play is over; mid-round
      // level scores are just a tied match.
      chipOffRequired = final && input.chipOffWinner === null;
    }
  }

  const winner: "A" | "B" | null = final ? (leader ?? input.chipOffWinner) : null;
  const chipOffRecorded = final && leader === null && input.chipOffWinner !== null;

  const banner: CupBanner = input.eventShortened
    ? "shortened"
    : pairingsPending
      ? "pairings_pending"
      : chipOffRequired
        ? "chip_off_required"
        : chipOffRecorded
          ? "chip_off_recorded"
          : null;

  return {
    official,
    holesWon,
    possiblePoints,
    decidedPoints,
    pointsToWin,
    clinched,
    final,
    pairingsPending,
    leader,
    leaderBasis,
    chipOffRequired,
    winner,
    banner,
    eventShortened: input.eventShortened,
    rounds: roundResults,
    countedRoundNumbers: counted.map((r) => r.roundNumber),
  };
}

export interface ProjectedStandings {
  /** The official total, untouched: projection is NEVER mixed into it. */
  official: Pts;
  /** Points each side would add if every in-progress segment ended as it stands right now. */
  projectedExtra: Pts;
  /** official + projectedExtra, for the "If it ended now" line only. */
  projectedTotal: Pts;
}

/** A segment still open with at least one hole played projects at its current status: up = a win,
 *  all square = a halve. Not-started segments and closed segments (already official) add nothing. */
function projectSegment(seg: MatchState["front9"]): Pts {
  if (seg.status === "closed" || seg.thru === 0) return { a: 0, b: 0 };
  if (seg.holesUp > 0) return { a: 1, b: 0 };
  if (seg.holesUp < 0) return { a: 0, b: 1 };
  return { a: 0.5, b: 0.5 };
}

export function projectedStandings(input: CupInput): ProjectedStandings {
  const standings = cupStandings(input);
  const extra: Pts = { a: 0, b: 0 };
  for (const round of standings.rounds) {
    if (!round.counts) continue;
    for (const m of round.matches) {
      for (const seg of [m.state.front9, m.state.back9, m.state.overall18]) {
        const p = projectSegment(seg);
        extra.a += p.a;
        extra.b += p.b;
      }
    }
  }
  return {
    official: { ...standings.official },
    projectedExtra: extra,
    projectedTotal: { a: standings.official.a + extra.a, b: standings.official.b + extra.b },
  };
}

export type MatchCardState = "not_started" | "live" | "final";

export interface MatchCardStatus {
  state: MatchCardState;
  /** "Not started" | "N 2 UP thru 11" | "AS thru 6" | "N won 18 — back 9 still live" | "N wins 2½–½" */
  status: string;
  /** Set when state === "final": "N wins 2½–½" / "S wins 2½–½" / "Halved 1½–1½". */
  final: string | null;
}

/** Display strings for a match card — derived from the engine's match state only. */
export function matchCardStatus(state: MatchState): MatchCardStatus {
  const overall = state.overall18;
  const a = formatPoints(state.totalPoints.a);
  const b = formatPoints(state.totalPoints.b);

  if (isMatchDecided(state)) {
    const text =
      state.totalPoints.a > state.totalPoints.b
        ? `N wins ${a}–${b}`
        : state.totalPoints.b > state.totalPoints.a
          ? `S wins ${b}–${a}`
          : `Halved ${a}–${b}`;
    return { state: "final", status: text, final: text };
  }

  if (overall.thru === 0 && state.front9.thru === 0 && state.back9.thru === 0) {
    return { state: "not_started", status: "Not started", final: null };
  }

  if (overall.status === "closed") {
    const who = overall.winner === "A" ? "N" : overall.winner === "B" ? "S" : "";
    const open = [state.front9, state.back9].some((s) => s.status === "in_progress");
    return {
      state: "live",
      status: overall.winner === "halved" ? "18 halved — a 9 still live" : `${who} won 18${open ? " — a 9 still live" : ""}`,
      final: null,
    };
  }

  const label = segmentLabel(overall);
  return { state: "live", status: `${label.text} thru ${overall.thru}`, final: null };
}


export interface CupHeadline {
  /** "12½ to win" — null until every round has duos (pairings pending) or nothing is in play. */
  toWin: string | null;
  /** "21 of 21 points decided" — possible points come from the matches that exist. Null with none. */
  progress: string | null;
  /** The one status line under the score: pending / clinched / winner / chip-off / shortened. */
  line: string | null;
  tone: "none" | "north" | "south" | "alert";
}

const TEAM = { A: "North Hedges", B: "South Hedges" } as const;

/** The Cup header text. Pure, so the "to win" and "win the Cup" wording is pinned by tests. */
export function cupHeadline(c: CupStandings): CupHeadline {
  const toWin = !c.pairingsPending && c.pointsToWin !== null ? `${formatPoints(c.pointsToWin)} to win` : null;
  const progress = c.possiblePoints > 0 ? `${formatPoints(c.decidedPoints)} of ${c.possiblePoints} points decided` : null;

  if (c.banner === "chip_off_required") return { toWin, progress, line: "Chip-off required — level on points and holes won", tone: "alert" };
  if (c.winner) {
    const how = c.banner === "chip_off_recorded" ? " (chip-off)" : c.leaderBasis === "holes" ? " (on holes won)" : "";
    const shortened = c.banner === "shortened" ? " — shortened event" : "";
    return { toWin, progress, line: `${TEAM[c.winner]} win the Cup${how}${shortened}`, tone: c.winner === "A" ? "north" : "south" };
  }
  if (c.clinched) return { toWin, progress, line: `${TEAM[c.clinched]} have clinched the Cup`, tone: c.clinched === "A" ? "north" : "south" };
  if (c.pairingsPending) return { toWin, progress, line: "Pairings pending", tone: "none" };
  return { toWin, progress, line: null, tone: "none" };
}

/**
 * The commissioner may record a chip-off winner ONLY when the engine says one is required: the counted
 * play is over and the teams are level on points and holes won, with nobody recorded yet. The admin
 * action calls this server-side, so a hidden button is never the only guard.
 */
export function canRecordChipOff(c: CupStandings): { ok: boolean; message: string | null } {
  return c.chipOffRequired
    ? { ok: true, message: null }
    : { ok: false, message: "No chip-off is required right now — points or holes won separate the teams." };
}
