// Drives Used — PRODUCT_SPEC_V2 §2 "Drives Used": one tap per hole, which partner's tee shot
// the duo played. Purely informational, feeds a "who carried" leaderboard — never touches
// match state, points, or money.

export interface DrivesUsedEntry {
  roundId: string;
  hole: number;
  playerId: string;
}

/** Count of tee shots used per player, across whatever entries are given (one round or the
 *  whole trip — the caller decides scope by which entries it passes in). */
export function drivesUsedTally(entries: DrivesUsedEntry[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const e of entries) {
    tally[e.playerId] = (tally[e.playerId] ?? 0) + 1;
  }
  return tally;
}
