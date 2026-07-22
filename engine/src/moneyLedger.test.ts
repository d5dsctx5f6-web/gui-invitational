import { describe, expect, it } from "vitest";
import { computeSkins, type SkinsHoleScore } from "./skins";
import { runningLedger, skinsPayouts, type SettledBet } from "./moneyLedger";

describe("skinsPayouts", () => {
  it("splits the pot evenly across 18 holes and pays covered holes at that rate", () => {
    const wins = [
      { resolvingHole: 1, coveredHoles: [1], winner: "A" },
      { resolvingHole: 7, coveredHoles: [4, 5, 6, 7], winner: "B" },
    ];
    // 13 entrants x $20 = $260 pot / 18 = $14.444.../hole
    const payouts = skinsPayouts(wins, 13, 20);

    expect(payouts.A).toBeCloseTo(260 / 18, 5);
    expect(payouts.B).toBeCloseTo((260 / 18) * 4, 5);
  });

  it("buyIn of 0 (not yet set by admin) yields all-zero payouts, not an error", () => {
    const wins = [{ resolvingHole: 1, coveredHoles: [1], winner: "A" }];
    expect(skinsPayouts(wins, 13, 0)).toEqual({ A: 0 });
  });

  it("a real round trip through computeSkins feeds skinsPayouts correctly", () => {
    const scores: SkinsHoleScore[] = [
      { playerId: "A", hole: 1, strokes: 4 },
      { playerId: "B", hole: 1, strokes: 5 },
    ];
    const result = computeSkins(scores, ["A", "B"]);
    const payouts = skinsPayouts(result.wins, 2, 18);

    // 2 x $18 = $36 / 18 holes = $2/hole, A won 1 hole
    expect(payouts).toEqual({ A: 2 });
  });
});

describe("runningLedger", () => {
  it("combines skins payouts with settled bet outcomes", () => {
    const bets: SettledBet[] = [
      { proposerId: "A", acceptorId: "B", stake: 20, winnerPlayerId: "A" },
    ];
    const ledger = runningLedger({ A: 10, B: 4 }, bets);

    expect(ledger.A).toBe(30);
    expect(ledger.B).toBe(-16);
  });

  it("a settled bet between two players with no skins still produces ledger entries", () => {
    const bets: SettledBet[] = [
      { proposerId: "C", acceptorId: "D", stake: 5, winnerPlayerId: "D" },
    ];
    const ledger = runningLedger({}, bets);

    expect(ledger.D).toBe(5);
    expect(ledger.C).toBe(-5);
  });

  it("multiple settled bets accumulate for the same player", () => {
    const bets: SettledBet[] = [
      { proposerId: "A", acceptorId: "B", stake: 10, winnerPlayerId: "A" },
      { proposerId: "A", acceptorId: "C", stake: 5, winnerPlayerId: "C" },
    ];
    const ledger = runningLedger({}, bets);

    expect(ledger.A).toBe(5); // +10 - 5
    expect(ledger.B).toBe(-10);
    expect(ledger.C).toBe(5);
  });

  it("a player with zero skins and zero bets has no entry at all", () => {
    const ledger = runningLedger({ A: 10 }, []);
    expect(ledger).toEqual({ A: 10 });
    expect(ledger.Z).toBeUndefined();
  });
});
