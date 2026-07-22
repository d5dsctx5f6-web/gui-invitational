// Money — skins payouts in dollars, and the per-player running ledger. PRODUCT_SPEC §2 "Money".
// Pot splits evenly across all 18 holes regardless of how many skins carried into any one win —
// a win covering N carried-in holes pays N × (pot / 18). Buy-in is a per-round admin input
// (rounds.skins_buy_in) that may not be set yet; callers pass 0 when it's null, which correctly
// yields all-zero payouts rather than a hard block.

import type { SkinsWin } from "./skins";

/**
 * Dollar payout per player from a round's skins wins. `entrantCount` and `buyIn` come from
 * the same round the wins were computed for — pot = entrantCount × buyIn, split over 18 holes.
 */
export function skinsPayouts(
  wins: SkinsWin[],
  entrantCount: number,
  buyIn: number,
): Record<string, number> {
  const dollarPerHole = (entrantCount * buyIn) / 18;
  const payouts: Record<string, number> = {};

  for (const win of wins) {
    payouts[win.winner] =
      (payouts[win.winner] ?? 0) + win.coveredHoles.length * dollarPerHole;
  }

  return payouts;
}

export interface SettledBet {
  proposerId: string;
  acceptorId: string;
  stake: number;
  winnerPlayerId: string;
}

/**
 * Net dollars per player: skins payouts plus settled challenge bets (winner +stake, loser
 * -stake). Only ever includes players who appear in at least one input — someone with zero
 * skins and zero bets simply doesn't get an entry, not a zero row.
 */
export function runningLedger(
  skinsPayoutsByPlayer: Record<string, number>,
  settledBets: SettledBet[],
): Record<string, number> {
  const ledger: Record<string, number> = { ...skinsPayoutsByPlayer };

  for (const bet of settledBets) {
    const loserId =
      bet.winnerPlayerId === bet.proposerId ? bet.acceptorId : bet.proposerId;
    ledger[bet.winnerPlayerId] = (ledger[bet.winnerPlayerId] ?? 0) + bet.stake;
    ledger[loserId] = (ledger[loserId] ?? 0) - bet.stake;
  }

  return ledger;
}
