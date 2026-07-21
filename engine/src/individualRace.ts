// Individual net race — cumulative across both competitive rounds. PRODUCT_SPEC §2
// "Individual race". Takes pre-computed net-per-hole entries (same pattern as
// matchState's DuoHoleNets): the caller derives net from the real score
// (netScore(realScore(row), dots)), never the match score — RM-proof by construction.

export interface PlayerHoleNet {
  playerId: string;
  roundId: string;
  hole: number;
  net: number;
}

export interface IndividualStanding {
  playerId: string;
  cumulativeNet: number;
  holesPlayed: number;
}

export interface DailyLowNet {
  roundId: string;
  net: number;
  /** Ties share the low — never forced to a single winner. */
  playerIds: string[];
}

export interface IndividualRaceResult {
  /** Sorted low-to-high. Equal cumulative nets are left equal — no tie-breaking here. */
  standings: IndividualStanding[];
  dailyLows: DailyLowNet[];
}

export function computeIndividualRace(
  entries: PlayerHoleNet[],
): IndividualRaceResult {
  const totals = new Map<string, { net: number; holes: number }>();
  for (const e of entries) {
    const cur = totals.get(e.playerId) ?? { net: 0, holes: 0 };
    cur.net += e.net;
    cur.holes += 1;
    totals.set(e.playerId, cur);
  }

  const standings: IndividualStanding[] = Array.from(
    totals.entries(),
  )
    .map(([playerId, v]) => ({
      playerId,
      cumulativeNet: v.net,
      holesPlayed: v.holes,
    }))
    .sort((a, b) => a.cumulativeNet - b.cumulativeNet);

  const roundIds = [...new Set(entries.map((e) => e.roundId))];
  const dailyLows: DailyLowNet[] = roundIds.map((roundId) => {
    const perPlayer = new Map<string, number>();
    for (const e of entries) {
      if (e.roundId !== roundId) continue;
      perPlayer.set(e.playerId, (perPlayer.get(e.playerId) ?? 0) + e.net);
    }
    const values = Array.from(perPlayer.values());
    const low = Math.min(...values);
    const playerIds = Array.from(perPlayer.entries())
      .filter(([, net]) => net === low)
      .map(([playerId]) => playerId);
    return { roundId, net: low, playerIds };
  });

  return { standings, dailyLows };
}
