import { describe, expect, it } from "vitest";
import { deriveMatches, isShortHanded, validateDuo, type ExistingDuo } from "./duoValidation";

const N = "team-north";
const S = "team-south";
const ctxBase = {
  rosterByTeam: {
    [N]: ["n1", "n2", "n3", "n4"],
    [S]: ["s1", "s2", "s3", "s4"],
  },
};
const duo = (over: Partial<ExistingDuo>): ExistingDuo => ({
  id: "d1",
  roundId: "sat",
  teamId: N,
  player1Id: "n1",
  player2Id: "n2",
  matchSlot: 1,
  ...over,
});

describe("validateDuo", () => {
  it("accepts a clean duo", () => {
    const r = validateDuo({ roundId: "sat", teamId: N, player1Id: "n1", player2Id: "n2", matchSlot: 1 }, { ...ctxBase, existingDuos: [] });
    expect(r.errors).toEqual([]);
    expect(r.shortHanded).toBe(false);
  });

  it("rejects a player already in another duo the same round, on either side of the duo", () => {
    const existing = [duo({ id: "d1", player1Id: "n1", player2Id: "n2", matchSlot: 1 })];
    for (const input of [
      { player1Id: "n1", player2Id: "n3" },
      { player1Id: "n3", player2Id: "n2" },
    ]) {
      const r = validateDuo({ roundId: "sat", teamId: N, matchSlot: 2, ...input }, { ...ctxBase, existingDuos: existing });
      expect(r.errors.join()).toContain("two duos in the same round");
    }
  });

  it("allows the same player in a different round", () => {
    const existing = [duo({ roundId: "sat" })];
    const r = validateDuo({ roundId: "sun", teamId: N, player1Id: "n1", player2Id: "n2", matchSlot: 1 }, { ...ctxBase, existingDuos: existing });
    expect(r.errors).toEqual([]);
  });

  it("rejects players who aren't on the duo's team", () => {
    const r = validateDuo({ roundId: "sat", teamId: N, player1Id: "n1", player2Id: "s1", matchSlot: 1 }, { ...ctxBase, existingDuos: [] });
    expect(r.errors.join()).toContain("Player 2 isn't on this team");
  });

  it("rejects the same player twice", () => {
    const r = validateDuo({ roundId: "sat", teamId: N, player1Id: "n1", player2Id: "n1", matchSlot: 1 }, { ...ctxBase, existingDuos: [] });
    expect(r.errors.join()).toContain("same player twice");
  });

  it("holds at most one duo per team per slot, but one North and one South can share a slot", () => {
    const existing = [duo({ id: "d1", teamId: N, matchSlot: 1 })];
    const sameTeam = validateDuo({ roundId: "sat", teamId: N, player1Id: "n3", player2Id: "n4", matchSlot: 1 }, { ...ctxBase, existingDuos: existing });
    expect(sameTeam.errors.join()).toContain("already has a duo in this slot");
    const otherTeam = validateDuo({ roundId: "sat", teamId: S, player1Id: "s1", player2Id: "s2", matchSlot: 1 }, { ...ctxBase, existingDuos: existing });
    expect(otherTeam.errors).toEqual([]);
  });

  it("editing a duo doesn't collide with itself", () => {
    const existing = [duo({ id: "d1" })];
    const r = validateDuo({ id: "d1", roundId: "sat", teamId: N, player1Id: "n1", player2Id: "n3", matchSlot: 1 }, { ...ctxBase, existingDuos: existing });
    expect(r.errors).toEqual([]);
  });

  it("allows a null player 2 (short-handed) and flags it", () => {
    const r = validateDuo({ roundId: "sat", teamId: N, player1Id: "n1", player2Id: null, matchSlot: 1 }, { ...ctxBase, existingDuos: [] });
    expect(r.errors).toEqual([]);
    expect(r.shortHanded).toBe(true);
    expect(isShortHanded({ player2Id: null })).toBe(true);
    expect(isShortHanded({ player2Id: "n2" })).toBe(false);
  });

  it("doesn't force four slots: one lone duo is valid", () => {
    const r = validateDuo({ roundId: "sat", teamId: S, player1Id: "s1", player2Id: "s2", matchSlot: 3 }, { ...ctxBase, existingDuos: [] });
    expect(r.errors).toEqual([]);
  });

  it("rejects an out-of-range slot", () => {
    for (const matchSlot of [0, 5, 1.5]) {
      const r = validateDuo({ roundId: "sat", teamId: N, player1Id: "n1", player2Id: "n2", matchSlot }, { ...ctxBase, existingDuos: [] });
      expect(r.errors.join()).toContain("Match slot");
    }
  });
});

describe("deriveMatches", () => {
  it("pairs a North and South duo sharing a slot, leaving missing sides null", () => {
    const duos = [
      duo({ id: "a", teamId: N, matchSlot: 1 }),
      duo({ id: "b", teamId: S, matchSlot: 1, player1Id: "s1", player2Id: "s2" }),
      duo({ id: "c", teamId: N, matchSlot: 2, player1Id: "n3", player2Id: "n4" }),
    ];
    const m = deriveMatches(duos, N, S);
    expect(m.map((x) => x.matchSlot)).toEqual([1, 2]);
    expect(m[0].north?.id).toBe("a");
    expect(m[0].south?.id).toBe("b");
    expect(m[1].south).toBeNull();
  });
});
