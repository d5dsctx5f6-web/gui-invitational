import { describe, expect, it } from "vitest";
import { canScoreDuo, type PermissionDuo } from "./scorePermissions";
import { canChangeFormat, FORMAT_LOCKED_MESSAGE } from "./formatLock";
import { assertQaSeason, QA_RESET_ORDER } from "./qaSafety";
import { currentSeason, inScope } from "./seasonScope";
import { applyScope } from "../../lib/scope";

// 2027 Saturday slot 1 (real players), 2027 Saturday slot 2, and the QA match (round r-qa, slot 1).
const duos: PermissionDuo[] = [
  { id: "sat1-n", roundId: "r-sat", matchSlot: 1, playerIds: ["chris", "cj"] },
  { id: "sat1-s", roundId: "r-sat", matchSlot: 1, playerIds: ["spencer", "will"] },
  { id: "sat2-n", roundId: "r-sat", matchSlot: 2, playerIds: ["zac", null] }, // short-handed
  { id: "sat2-s", roundId: "r-sat", matchSlot: 2, playerIds: ["ian", "rory"] },
  { id: "sun1-n", roundId: "r-sun", matchSlot: 1, playerIds: ["chris", "will"] },
  { id: "qa-n", roundId: "r-qa", matchSlot: 1, playerIds: ["qa-n1", "qa-n2"] },
  { id: "qa-s", roundId: "r-qa", matchSlot: 1, playerIds: ["qa-s1", "qa-s2"] },
];

describe("canScoreDuo (mirror of the can_score_duo RLS helper)", () => {
  it("any of the four players in the match may write BOTH duos", () => {
    for (const p of ["chris", "cj", "spencer", "will"]) {
      expect(canScoreDuo(p, "sat1-n", duos)).toBe(true);
      expect(canScoreDuo(p, "sat1-s", duos)).toBe(true);
    }
  });

  it("a player in another match of the same round is denied", () => {
    expect(canScoreDuo("zac", "sat1-n", duos)).toBe(false);
    expect(canScoreDuo("ian", "sat1-s", duos)).toBe(false);
    expect(canScoreDuo("chris", "sat2-n", duos)).toBe(false);
  });

  it("the same player is denied for a different round's match unless he is in it", () => {
    expect(canScoreDuo("cj", "sun1-n", duos)).toBe(false); // cj isn't in Sunday's duo
    expect(canScoreDuo("chris", "sun1-n", duos)).toBe(true);
  });

  it("a short-handed duo's partner and opponents can still score it", () => {
    expect(canScoreDuo("zac", "sat2-s", duos)).toBe(true);
    expect(canScoreDuo("rory", "sat2-n", duos)).toBe(true);
  });

  it("a QA player can score only the QA match — never a 2027 duo (another season)", () => {
    expect(canScoreDuo("qa-n1", "qa-s", duos)).toBe(true);
    expect(canScoreDuo("qa-n1", "sat1-n", duos)).toBe(false);
    expect(canScoreDuo("qa-s2", "sun1-n", duos)).toBe(false);
    // and a real player can't write the QA match
    expect(canScoreDuo("chris", "qa-n", duos)).toBe(false);
  });

  it("signed-out sessions and unknown duos are denied", () => {
    expect(canScoreDuo(null, "sat1-n", duos)).toBe(false);
    expect(canScoreDuo("chris", "nope", duos)).toBe(false);
  });
});

describe("format lock", () => {
  it("allows a switch before any score exists", () => {
    expect(canChangeFormat(0)).toEqual({ allowed: true, message: null });
  });
  it("blocks it once any score exists, with the plain message", () => {
    expect(canChangeFormat(1)).toEqual({ allowed: false, message: FORMAT_LOCKED_MESSAGE });
    expect(FORMAT_LOCKED_MESSAGE).toBe("Format is locked — scores have been posted for this round.");
  });
});

describe("QA reset safety", () => {
  it("refuses any season where is_test = false", () => {
    expect(() => assertQaSeason({ id: "s2027", isTest: false })).toThrow(/not a test season/);
    expect(() => assertQaSeason(null)).toThrow(/not found/);
    expect(() => assertQaSeason(undefined)).toThrow(/not found/);
  });
  it("accepts a test season", () => {
    expect(() => assertQaSeason({ id: "s1900", isTest: true })).not.toThrow();
  });
  it("deletes children before parents (RESTRICT-safe order)", () => {
    expect([...QA_RESET_ORDER]).toEqual(["player_hole_scores", "hole_scores", "reverse_mulligans", "duos", "rounds"]);
  });
});

describe("season and roster isolation", () => {
  const seasons = [
    { id: "s2027", year: 2027, isTest: false },
    { id: "s1900", year: 1900, isTest: true },
    { id: "s9999", year: 9999, isTest: true }, // even a QA season with the newest year must never be "current"
  ];
  const players = [
    { id: "chris", isTest: false },
    { id: "qa-n1", isTest: true },
  ];

  it("the current season is the newest NON-test season", () => {
    expect(currentSeason(seasons)?.id).toBe("s2027");
    expect(currentSeason([{ id: "s1900", year: 1900, isTest: true }])).toBeNull();
  });

  it("real reads never return test rows, and QA reads never return real rows", () => {
    expect(inScope(seasons, "real").map((s) => s.id)).toEqual(["s2027"]);
    expect(inScope(seasons, "qa").map((s) => s.id)).toEqual(["s1900", "s9999"]);
    expect(inScope(players, "real").map((p) => p.id)).toEqual(["chris"]);
    expect(inScope(players, "qa").map((p) => p.id)).toEqual(["qa-n1"]);
  });

  it("the query helper adds is_test = false for real reads and = true for QA reads", () => {
    const calls: [string, boolean][] = [];
    const q = { eq(col: string, v: boolean) { calls.push([col, v]); return q; } };
    applyScope(q, "real");
    applyScope(q); // default scope is real
    applyScope(q, "qa");
    expect(calls).toEqual([["is_test", false], ["is_test", false], ["is_test", true]]);
  });
});
