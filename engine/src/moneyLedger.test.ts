import { describe, expect, it } from "vitest";
import { runningLedger, type SettledBet } from "./moneyLedger";

// Brief 31: skinsPayouts() and its tests are gone along with skins.ts. runningLedger() no
// longer takes a skins-payouts parameter -- settled Challenge Ledger bets are the only money
// source left (PRODUCT_SPEC_V2 §2).

describe("runningLedger", () => {
  it("a settled bet produces winner/loser ledger entries", () => {
    const bets: SettledBet[] = [
      { proposerId: "A", acceptorId: "B", stake: 20, winnerPlayerId: "A" },
    ];
    const ledger = runningLedger(bets);
    expect(ledger.A).toBe(20);
    expect(ledger.B).toBe(-20);
  });

  it("the acceptor can win too, not just the proposer", () => {
    const bets: SettledBet[] = [
      { proposerId: "C", acceptorId: "D", stake: 5, winnerPlayerId: "D" },
    ];
    const ledger = runningLedger(bets);
    expect(ledger.D).toBe(5);
    expect(ledger.C).toBe(-5);
  });

  it("multiple settled bets accumulate for the same player", () => {
    const bets: SettledBet[] = [
      { proposerId: "A", acceptorId: "B", stake: 10, winnerPlayerId: "A" },
      { proposerId: "A", acceptorId: "C", stake: 5, winnerPlayerId: "C" },
    ];
    const ledger = runningLedger(bets);
    expect(ledger.A).toBe(5); // +10 - 5
    expect(ledger.B).toBe(-10);
    expect(ledger.C).toBe(5);
  });

  it("a player with zero settled bets has no entry at all", () => {
    const ledger = runningLedger([]);
    expect(ledger).toEqual({});
    expect(ledger.Z).toBeUndefined();
  });
});
