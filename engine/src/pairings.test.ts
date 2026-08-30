import { describe, expect, it } from "vitest";
import { fridayPairingsOrder, sundayPairingsOrder } from "./pairings";

describe("fridayPairingsOrder", () => {
  it("the coin-flip winner declares cycle 1 when they chose to declare", () => {
    const order = fridayPairingsOrder("North", "South", "declare");
    expect(order.cycles).toEqual([
      { cycle: 1, declaringTeamId: "North", counteringTeamId: "South" },
      { cycle: 2, declaringTeamId: "South", counteringTeamId: "North" },
      { cycle: 3, declaringTeamId: "North", counteringTeamId: "South" },
    ]);
  });

  it("the coin-flip winner counters cycle 1 when they chose to counter", () => {
    const order = fridayPairingsOrder("North", "South", "counter");
    expect(order.cycles).toEqual([
      { cycle: 1, declaringTeamId: "South", counteringTeamId: "North" },
      { cycle: 2, declaringTeamId: "North", counteringTeamId: "South" },
      { cycle: 3, declaringTeamId: "South", counteringTeamId: "North" },
    ]);
  });

  it("roles alternate every cycle, never repeat back-to-back", () => {
    const order = fridayPairingsOrder("North", "South", "declare");
    for (let i = 1; i < order.cycles.length; i++) {
      expect(order.cycles[i].declaringTeamId).not.toBe(order.cycles[i - 1].declaringTeamId);
    }
  });
});

describe("sundayPairingsOrder", () => {
  it("whoever countered first on Friday declares first on Sunday", () => {
    const friday = fridayPairingsOrder("North", "South", "declare");
    // North declared Friday cycle 1, so South countered first -> South declares Sunday cycle 1.
    const sunday = sundayPairingsOrder(friday);
    expect(sunday.cycles[0]).toEqual({
      cycle: 1,
      declaringTeamId: "South",
      counteringTeamId: "North",
    });
  });

  it("is the exact reverse of Friday's order, cycle for cycle", () => {
    const friday = fridayPairingsOrder("North", "South", "counter");
    const sunday = sundayPairingsOrder(friday);
    for (let i = 0; i < 3; i++) {
      expect(sunday.cycles[i].declaringTeamId).toBe(friday.cycles[i].counteringTeamId);
      expect(sunday.cycles[i].counteringTeamId).toBe(friday.cycles[i].declaringTeamId);
    }
  });

  it("is derived from Friday's own computed order, not an independent second calculation", () => {
    // Feed a hand-built (not fridayPairingsOrder-derived) order in and confirm Sunday still
    // just reverses cycle 1's roles from whatever it was given -- proving sundayPairingsOrder
    // has no coin-flip logic of its own, it's a pure function of Friday's result alone.
    const handBuiltFriday = {
      cycles: [
        { cycle: 1 as const, declaringTeamId: "X", counteringTeamId: "Y" },
        { cycle: 2 as const, declaringTeamId: "Y", counteringTeamId: "X" },
        { cycle: 3 as const, declaringTeamId: "X", counteringTeamId: "Y" },
      ],
    };
    const sunday = sundayPairingsOrder(handBuiltFriday);
    expect(sunday.cycles[0]).toEqual({ cycle: 1, declaringTeamId: "Y", counteringTeamId: "X" });
  });
});
