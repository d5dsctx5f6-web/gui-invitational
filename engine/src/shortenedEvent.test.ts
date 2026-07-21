import { describe, expect, it } from "vitest";
import {
  isRoundComplete,
  officialRounds,
  type HoleScorePresence,
  type RoundParticipant,
} from "./shortenedEvent";

function allHolesFor(playerId: string, roundId: string): HoleScorePresence[] {
  return Array.from({ length: 18 }, (_, i) => ({
    roundId,
    playerId,
    hole: i + 1,
  }));
}

describe("isRoundComplete", () => {
  it("is true when every participant has all 18 holes", () => {
    const participants: RoundParticipant[] = [
      { roundId: "R1", playerId: "A" },
      { roundId: "R1", playerId: "B" },
    ];
    const scores = [...allHolesFor("A", "R1"), ...allHolesFor("B", "R1")];
    expect(isRoundComplete(participants, scores, "R1")).toBe(true);
  });

  it("is false when one participant is missing even a single hole", () => {
    const participants: RoundParticipant[] = [
      { roundId: "R1", playerId: "A" },
      { roundId: "R1", playerId: "B" },
    ];
    const scores = [
      ...allHolesFor("A", "R1"),
      ...allHolesFor("B", "R1").slice(0, 17), // B missing hole 18
    ];
    expect(isRoundComplete(participants, scores, "R1")).toBe(false);
  });

  it("a player absent the whole round never blocks completeness", () => {
    // Only A is a participant this round; B (elsewhere) posting nothing is irrelevant.
    const participants: RoundParticipant[] = [{ roundId: "R1", playerId: "A" }];
    const scores = allHolesFor("A", "R1");
    expect(isRoundComplete(participants, scores, "R1")).toBe(true);
  });

  it("is false for a round with no participants at all", () => {
    expect(isRoundComplete([], [], "R1")).toBe(false);
  });
});

describe("officialRounds", () => {
  it("both rounds complete -> the full trip counts, not shortened", () => {
    const result = officialRounds([
      { roundId: "SAT", complete: true },
      { roundId: "SUN", complete: true },
    ]);
    expect(result).toEqual({ roundIds: ["SAT", "SUN"], shortened: false });
  });

  it("Saturday complete, Sunday incomplete -> only Saturday counts, shortened", () => {
    const result = officialRounds([
      { roundId: "SAT", complete: true },
      { roundId: "SUN", complete: false },
    ]);
    expect(result).toEqual({ roundIds: ["SAT"], shortened: true });
  });

  it("stops at the first incomplete round even if a later one is complete", () => {
    // Shouldn't happen chronologically, but the function shouldn't crash or skip ahead.
    const result = officialRounds([
      { roundId: "SAT", complete: false },
      { roundId: "SUN", complete: true },
    ]);
    expect(result).toEqual({ roundIds: [], shortened: true });
  });
});
