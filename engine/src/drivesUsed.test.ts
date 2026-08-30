import { describe, expect, it } from "vitest";
import { drivesUsedTally, type DrivesUsedEntry } from "./drivesUsed";

describe("drivesUsedTally", () => {
  it("counts tee shots used per player from raw entries", () => {
    const entries: DrivesUsedEntry[] = [
      { roundId: "SAT", hole: 1, playerId: "Chris" },
      { roundId: "SAT", hole: 2, playerId: "Matt" },
      { roundId: "SAT", hole: 3, playerId: "Chris" },
    ];
    expect(drivesUsedTally(entries)).toEqual({ Chris: 2, Matt: 1 });
  });

  it("a player who never carried the drive has no entry at all, not a zero", () => {
    const entries: DrivesUsedEntry[] = [{ roundId: "SAT", hole: 1, playerId: "Chris" }];
    const tally = drivesUsedTally(entries);
    expect(tally.Matt).toBeUndefined();
  });

  it("returns an empty tally for no entries", () => {
    expect(drivesUsedTally([])).toEqual({});
  });

  it("scope is caller-controlled: passing both rounds' entries tallies across the whole trip", () => {
    const entries: DrivesUsedEntry[] = [
      { roundId: "SAT", hole: 1, playerId: "Chris" },
      { roundId: "SUN", hole: 1, playerId: "Chris" },
    ];
    expect(drivesUsedTally(entries)).toEqual({ Chris: 2 });
  });
});
