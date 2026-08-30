// Pairings Night order derivation. PRODUCT_SPEC_V2 §2 "Pairings Night — the live
// declare-and-counter draft": a coin flip, once, before Friday's Pairings Night decides who
// declares first and who counters first. Three declare-and-counter cycles set three of the
// four matches (roles alternate each cycle); the fourth match is forced — no declare, no
// counter. Sunday's order reverses Friday's automatically, no second coin flip: whoever
// countered first on Friday declares first on Sunday.
//
// store-raw-derive-everything, applied to the coin flip itself (ARCHITECTURE §3): only the
// coin flip winner + their declare/counter choice is ever stored (`seasons.coin_flip_*`).
// Both Friday's full cycle order and Sunday's reversal are pure functions of that one fact —
// this is the whole payoff of storing the coin flip raw instead of each day's order
// independently (Brief 31 Part B).
//
// v1.0's "earned Sunday pairings from Saturday standings" is retired — this file's old
// computeEarnedPairings() is gone. Same filename, entirely different purpose: this is about
// *who calls picks in what order*, not *who plays whom* (that's what the pairings themselves
// resolve to, via the actual declare/counter picks made live at the board — out of scope for
// this pure function, which only derives the calling order).

export type PairingsRole = "declare" | "counter";

export interface PairingsCycle {
  cycle: 1 | 2 | 3;
  declaringTeamId: string;
  counteringTeamId: string;
}

export interface PairingsOrder {
  /** Exactly 3 — the fourth match is always forced, no declare/counter role to derive. */
  cycles: PairingsCycle[];
}

/** Builds the 3-cycle alternating order given which team declares cycle 1. */
function cyclesFrom(cycle1DeclaringTeamId: string, cycle1CounteringTeamId: string): PairingsCycle[] {
  const cycles: PairingsCycle[] = [];
  let declaring = cycle1DeclaringTeamId;
  let countering = cycle1CounteringTeamId;
  for (let cycle = 1; cycle <= 3; cycle++) {
    cycles.push({ cycle: cycle as 1 | 2 | 3, declaringTeamId: declaring, counteringTeamId: countering });
    [declaring, countering] = [countering, declaring]; // roles alternate each cycle
  }
  return cycles;
}

/**
 * Friday's declare/counter order, derived from the coin flip alone. The winner's role in
 * cycle 1 is their own choice (`coinFlipChoice`); roles alternate from there.
 */
export function fridayPairingsOrder(
  coinFlipWinnerTeamId: string,
  otherTeamId: string,
  coinFlipChoice: PairingsRole,
): PairingsOrder {
  const [cycle1Declaring, cycle1Countering] =
    coinFlipChoice === "declare"
      ? [coinFlipWinnerTeamId, otherTeamId]
      : [otherTeamId, coinFlipWinnerTeamId];
  return { cycles: cyclesFrom(cycle1Declaring, cycle1Countering) };
}

/**
 * Sunday's order — the reverse of Friday's, never independently computed. Whoever countered
 * first on Friday (cycle 1) declares first on Sunday. Takes Friday's own derived order, not
 * the raw coin-flip fact again, so this is provably a derivation of Friday's result, not a
 * second independent calculation that happens to agree with it.
 */
export function sundayPairingsOrder(fridayOrder: PairingsOrder): PairingsOrder {
  const fridayCycle1 = fridayOrder.cycles[0];
  return {
    cycles: cyclesFrom(fridayCycle1.counteringTeamId, fridayCycle1.declaringTeamId),
  };
}
