import { describe, expect, it } from "vitest";
import { reverseMulliganStatus, type ReverseMulliganEvent } from "./reverseMulligan";

// Brief 31: the two-score rule (matchScore vs realScore) this file used to test alongside
// reverseMulliganStatus is gone — netScore.ts is deleted, and there's no divergent-score
// branch left to test against. A reverse mulligan's replay result is simply what gets posted
// to hole_scores.strokes; computeMatchState reads that one number the same as any other hole.
// See fullTrip.test.ts's "reverse mulligan" section for that one-score-in-one-score-out proof
// inside a real simulated match, which is where it's actually meaningful now.

describe("reverseMulliganStatus", () => {
  it("is available when no event exists for that duo/round", () => {
    const events: ReverseMulliganEvent[] = [];
    expect(reverseMulliganStatus(events, "DuoA", "R1")).toEqual({
      available: true,
      usedOnHole: null,
    });
  });

  it("is burned once an event exists, and reflects the hole it was used on", () => {
    const events: ReverseMulliganEvent[] = [{ duoId: "DuoA", roundId: "R1", hole: 11 }];
    expect(reverseMulliganStatus(events, "DuoA", "R1")).toEqual({
      available: false,
      usedOnHole: 11,
    });
  });

  it("does not confuse a different duo or round", () => {
    const events: ReverseMulliganEvent[] = [{ duoId: "DuoA", roundId: "R1", hole: 11 }];
    expect(reverseMulliganStatus(events, "DuoB", "R1").available).toBe(true);
    expect(reverseMulliganStatus(events, "DuoA", "R2").available).toBe(true);
  });

  it("is deterministic — the same duo/round query always returns the same value", () => {
    const events: ReverseMulliganEvent[] = [{ duoId: "DuoA", roundId: "R1", hole: 11 }];
    expect(reverseMulliganStatus(events, "DuoA", "R1")).toEqual(
      reverseMulliganStatus(events, "DuoA", "R1"),
    );
  });
});
