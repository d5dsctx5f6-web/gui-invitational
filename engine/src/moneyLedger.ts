// Money — the per-player running ledger. PRODUCT_SPEC_V2 §2 "Money": the Challenge Ledger is
// the sole money mechanism now (skins is retired) — "Nothing else. No skins, no cup pot."
//
// Brief 31: skinsPayouts() is deleted along with skins.ts, which it depended on for the
// SkinsWin type. runningLedger() survives but drops its skins-payouts parameter — there is no
// other money source to combine settled bets with anymore, so the function's whole "combine
// two sources" framing collapses to "tally settled bets."

export interface SettledBet {
  proposerId: string;
  acceptorId: string;
  stake: number;
  winnerPlayerId: string;
}

/**
 * Net dollars per player from settled Challenge Ledger bets: winner +stake, loser -stake. Only
 * ever includes players who appear in at least one settled bet — someone with none simply
 * doesn't get an entry, not a zero row.
 */
export function runningLedger(settledBets: SettledBet[]): Record<string, number> {
  const ledger: Record<string, number> = {};

  for (const bet of settledBets) {
    const loserId =
      bet.winnerPlayerId === bet.proposerId ? bet.acceptorId : bet.proposerId;
    ledger[bet.winnerPlayerId] = (ledger[bet.winnerPlayerId] ?? 0) + bet.stake;
    ledger[loserId] = (ledger[loserId] ?? 0) - bet.stake;
  }

  return ledger;
}
