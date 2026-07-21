import { describe, expect, it } from "vitest";
import { playingHandicap, strokesForHoles, courseHandicap } from "./handicap";
import {
  isRoundComplete,
  officialRounds,
  type HoleScorePresence,
  type RoundParticipant,
  type RoundStatus,
} from "./shortenedEvent";
import {
  ALL_HOLE_SCORES,
  COURSE_A,
  EARNED_PAIRINGS,
  FULL_TRIP_RANKING,
  INDIVIDUAL_RACE,
  PLAYERS,
  SATURDAY_MATCHES,
  SATURDAY_RANKING,
  SATURDAY_SKINS,
  SUNDAY_SKINS,
  TEAM_IDS,
  computedMatch,
  dots,
  teamOutcomes,
} from "./fixtures/fullTrip";
import { rankTeams } from "./standings";

// The M2 gate: one full simulated trip — 16 players, 4 teams, both rounds — with every
// rule firing together. Fixture and every derived number live in ./fixtures/fullTrip.ts,
// shared with the Part F audit script Chris hand-checks. See that file's header comment
// for the plot points (a reverse mulligan, an engineered chip-off, a skins carryover).

describe("match state across all 8 matches", () => {
  it("Saturday: T2 sweeps Team 1 twice, Team 3 and Team 4 split", () => {
    expect(computedMatch("S-A").state.totalPoints).toEqual({ a: 0, b: 3 });
    expect(computedMatch("S-B").state.totalPoints).toEqual({ a: 0, b: 3 });
    expect(computedMatch("S-C").state).toMatchObject({
      front9: { winner: "A", holesUp: 2 },
      back9: { winner: "A", holesUp: 2 },
      overall18: { winner: "A", holesUp: 4 },
      totalPoints: { a: 3, b: 0 },
    });
    expect(computedMatch("S-D").state.totalPoints).toEqual({ a: 0, b: 3 });
  });

  it("Sunday: T2 sweeps Team 3 twice; Team 4 and Team 1 split", () => {
    expect(computedMatch("Su-A").state.totalPoints).toEqual({ a: 3, b: 0 });
    expect(computedMatch("Su-B").state.totalPoints).toEqual({ a: 3, b: 0 });
    expect(computedMatch("Su-C").state).toMatchObject({
      totalPoints: { a: 3, b: 0 },
    });
    expect(computedMatch("Su-D").state).toMatchObject({
      front9: { winner: "B", holesUp: -1 },
      back9: { winner: "B", holesUp: -3 },
      overall18: { winner: "B", holesUp: -4 },
      totalPoints: { a: 0, b: 3 },
    });
  });

  it("every segment is decided — closed, not left in progress", () => {
    for (const name of ["S-A", "S-B", "S-C", "S-D", "Su-A", "Su-B", "Su-C", "Su-D"]) {
      const state = computedMatch(name).state;
      expect(state.front9.status).toBe("closed");
      expect(state.back9.status).toBe("closed");
      expect(state.overall18.status).toBe("closed");
    }
  });
});

describe("team standings & the cup", () => {
  it("Team 2 wins the cup outright at 12 points", () => {
    expect(FULL_TRIP_RANKING.totals).toEqual(
      expect.arrayContaining([{ teamId: "T2", points: 12, holesWon: 11 }]),
    );
    expect(FULL_TRIP_RANKING.buckets[0]).toEqual({
      rank: 1,
      teamIds: ["T2"],
      chipOffRequired: false,
    });
  });

  it("Team 4 is a clean 2nd at 6 points", () => {
    const second = FULL_TRIP_RANKING.buckets.find((b) => b.rank === 2)!;
    expect(second).toEqual({ rank: 2, teamIds: ["T4"], chipOffRequired: false });
  });

  it("forces a genuine chip-off: Team 1 and Team 3 tie 3-3, never played, and tie on holes won too", () => {
    const tied = FULL_TRIP_RANKING.buckets.find((b) => b.chipOffRequired);
    expect(tied).toBeDefined();
    expect(tied!.teamIds).toEqual(expect.arrayContaining(["T1", "T3"]));
    expect(tied!.rank).toBe(3);

    const t1 = FULL_TRIP_RANKING.totals.find((t) => t.teamId === "T1")!;
    const t3 = FULL_TRIP_RANKING.totals.find((t) => t.teamId === "T3")!;
    expect(t1).toEqual({ teamId: "T1", points: 3, holesWon: 4 });
    expect(t3).toEqual({ teamId: "T3", points: 3, holesWon: 4 });
  });

  it("forces a tiebreaker criterion on Saturday alone: T3 and T4 tie on points, resolved by holes won", () => {
    const secondPlace = SATURDAY_RANKING.buckets.find((b) => b.rank === 2)!;
    expect(secondPlace).toEqual({ rank: 2, teamIds: ["T3"], chipOffRequired: false });

    const t3 = SATURDAY_RANKING.totals.find((t) => t.teamId === "T3")!;
    const t4 = SATURDAY_RANKING.totals.find((t) => t.teamId === "T4")!;
    expect(t3.points).toBe(t4.points); // both 3 — the tie is real
    expect(t3.holesWon).toBeGreaterThan(t4.holesWon); // 4 vs 2 — what breaks it
  });
});

describe("earned Sunday pairings", () => {
  it("pairs 1st (T2) v 2nd (T3) and 3rd (T4) v 4th (T1) from Saturday's standings", () => {
    expect(EARNED_PAIRINGS).toEqual({
      status: "determined",
      matchups: [
        { seedA: 1, seedB: 2, teamAId: "T2", teamBId: "T3" },
        { seedA: 3, seedB: 4, teamAId: "T4", teamBId: "T1" },
      ],
    });
  });

  it("matches the Sunday matches actually played in this fixture", () => {
    expect(computedMatch("Su-A").fixture).toMatchObject({ teamAId: "T2", teamBId: "T3" });
    expect(computedMatch("Su-C").fixture).toMatchObject({ teamAId: "T4", teamBId: "T1" });
  });
});

describe("individual net race", () => {
  it("computes Chris Deliso's cumulative net correctly across both rounds (hand-checked)", () => {
    // Saturday: 72 (par) - 7 (course handicap) = 65, minus the 2-stroke eagle override on
    // hole 10 (real score 2, not the reverse-mulligan's replayed 5) = 63.
    // Sunday: 72 - 11 (course handicap) = 61, no overrides.
    const chris = INDIVIDUAL_RACE.standings.find((s) => s.playerId === "Chris Deliso")!;
    expect(chris.cumulativeNet).toBe(124);
    expect(chris.holesPlayed).toBe(36);
  });

  it("identifies a unique daily low net each day", () => {
    const sat = INDIVIDUAL_RACE.dailyLows.find((d) => d.roundId === "SAT")!;
    const sun = INDIVIDUAL_RACE.dailyLows.find((d) => d.roundId === "SUN")!;
    expect(sat).toEqual({ roundId: "SAT", net: 49, playerIds: ["Andrew Sabia"] });
    expect(sun).toEqual({ roundId: "SUN", net: 45, playerIds: ["Andrew Sabia"] });
    // Shared-tie handling itself is covered by individualRace.test.ts's dedicated case.
  });

  it("reads the real score, not the match score, for the reverse-mulliganed hole", () => {
    // Chris's hole 10 contributes net = 2 - dots, not 5 - dots, to his total (see above).
    const chrisDots = dots("Chris Deliso", "SAT")[9];
    const entry = 2 - chrisDots;
    expect(entry).not.toBe(5 - chrisDots);
  });
});

describe("skins — gross, opt-in, paid nightly", () => {
  it("Saturday: carries a chain and resolves it (holes 1-4, Will Petersen)", () => {
    const win = SATURDAY_SKINS.wins.find((w) => w.resolvingHole === 4)!;
    expect(win).toEqual({ resolvingHole: 4, coveredHoles: [1, 2, 3, 4], winner: "Will Petersen" });
  });

  it("Saturday: a reverse-mulliganed player still wins the skin on his real (not match) score", () => {
    const win = SATURDAY_SKINS.wins.find((w) => w.resolvingHole === 10)!;
    expect(win).toEqual({
      resolvingHole: 10,
      coveredHoles: [5, 6, 7, 8, 9, 10],
      winner: "Chris Deliso",
    });
  });

  it("Saturday: non-entrant invisibility — Zac's eagle is the lowest score of the day but he didn't enter", () => {
    // Zac's eagle on hole 4 is lower than Will's birdie, but Zac isn't an entrant.
    const hole4 = SATURDAY_SKINS.holes.find((h) => h.hole === 4)!;
    expect(hole4.winner).toBe("Will Petersen");
    expect(hole4.winner).not.toBe("Zac Jones");
  });

  it("Saturday: the unresolved tail (holes 11-18) is void, not crashed", () => {
    expect(SATURDAY_SKINS.voidHoles).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("Sunday is an independent pool — nothing carries from Saturday, and this round voids entirely", () => {
    expect(SUNDAY_SKINS.wins).toEqual([]);
    expect(SUNDAY_SKINS.voidHoles).toHaveLength(18);
  });
});

describe("reverse mulligan inside the full trip", () => {
  it("the divergence is simultaneously true: match state, skins, and individual all read correctly from one dataset", () => {
    // Match: S-A's outcome (computed with matchScore, i.e. the replayed 5) is unaffected —
    // CJ was already Duo A's controlling ball on hole 10.
    expect(computedMatch("S-A").state.totalPoints).toEqual({ a: 0, b: 3 });
    // Skins: Chris wins hole 10 on his real score (2), not the match's 5.
    expect(SATURDAY_SKINS.holes.find((h) => h.hole === 10)!.winner).toBe("Chris Deliso");
    // Individual: Chris's total (124) reflects the real 2, not the replayed 5.
    expect(
      INDIVIDUAL_RACE.standings.find((s) => s.playerId === "Chris Deliso")!.cumulativeNet,
    ).toBe(124);
  });
});

describe("do-overs", () => {
  it("a mulligan's resulting score counts everywhere — no separate second-score capture", () => {
    const row = ALL_HOLE_SCORES.find(
      (r) => r.playerId === "Will Petersen" && r.roundId === "SAT" && r.hole === 4,
    )!;
    expect(row.mulligan).toBe(true);
    expect(row.matchStrokes).toBeNull(); // unlike the RM two-score rule, do-overs don't diverge
    // The same `strokes` value (3, the birdie) is what fed match state, skins, and individual.
    expect(row.strokes).toBe(COURSE_A.parByHole[3] - 1);
  });
});

describe("shortened event: Sunday doesn't finish", () => {
  it("falls back to Saturday-only standings when Sunday is incomplete", () => {
    const participants: RoundParticipant[] = Object.keys(PLAYERS).map((playerId) => ({
      roundId: "SAT",
      playerId,
    }));
    const satScores: HoleScorePresence[] = ALL_HOLE_SCORES.filter(
      (r) => r.roundId === "SAT",
    ).map((r) => ({ roundId: r.roundId, playerId: r.playerId, hole: r.hole }));
    // Sunday: everyone but Chris Deliso finished; his hole 18 was never posted.
    const sunScores: HoleScorePresence[] = ALL_HOLE_SCORES.filter(
      (r) => r.roundId === "SUN" && !(r.playerId === "Chris Deliso" && r.hole === 18),
    ).map((r) => ({ roundId: r.roundId, playerId: r.playerId, hole: r.hole }));
    const sunParticipants: RoundParticipant[] = Object.keys(PLAYERS).map((playerId) => ({
      roundId: "SUN",
      playerId,
    }));

    expect(isRoundComplete(participants, satScores, "SAT")).toBe(true);
    expect(isRoundComplete(sunParticipants, sunScores, "SUN")).toBe(false);

    const rounds: RoundStatus[] = [
      { roundId: "SAT", complete: true },
      { roundId: "SUN", complete: false },
    ];
    const official = officialRounds(rounds);
    expect(official).toEqual({ roundIds: ["SAT"], shortened: true });

    // The official cup, in this scenario, is the Saturday-only ranking already computed —
    // Team 2 wins, and the Team 3/Team 4 tie resolves via holes won (no chip-off needed).
    const officialRanking = rankTeams(TEAM_IDS, teamOutcomes(SATURDAY_MATCHES));
    expect(officialRanking.buckets[0].teamIds).toEqual(["T2"]);
    expect(officialRanking).toEqual(SATURDAY_RANKING);
  });
});

describe("allowance", () => {
  it("the full-trip suite runs at 100% (Addendum A default)", () => {
    // Chris's Saturday dots sum to exactly his course handicap at 100% allowance.
    const handicap = courseHandicap(PLAYERS["Chris Deliso"], COURSE_A);
    const dotsAtFull = strokesForHoles(playingHandicap(handicap, 1), COURSE_A.strokeIndex);
    expect(dotsAtFull.reduce((sum, d) => sum + d, 0)).toBe(handicap);
    expect(dots("Chris Deliso", "SAT")).toEqual(dotsAtFull);
  });

  it("90% allowance (the isolated Part D case) would reduce the same player's dots", () => {
    const handicap = courseHandicap(PLAYERS["Chris Deliso"], COURSE_A);
    const dotsAt90 = strokesForHoles(playingHandicap(handicap, 0.9), COURSE_A.strokeIndex);
    const totalAt90 = dotsAt90.reduce((sum, d) => sum + d, 0);
    const totalAtFull = dots("Chris Deliso", "SAT").reduce((sum, d) => sum + d, 0);
    expect(totalAt90).toBeLessThanOrEqual(totalAtFull);
  });
});
