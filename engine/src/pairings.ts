// Earned Sunday pairings from Saturday standings. PRODUCT_SPEC §2 / Addendum A §3:
// 1st plays 2nd, 3rd plays 4th — must produce a strict order, or surface the tie.

import type { TeamRanking } from "./standings";

export interface Matchup {
  seedA: number;
  seedB: number;
  teamAId: string;
  teamBId: string;
}

export type EarnedPairingsResult =
  | { status: "determined"; matchups: Matchup[] }
  | { status: "chipOffRequired"; tiedTeamIds: string[]; affectedSeeds: number[] };

export function computeEarnedPairings(
  ranking: TeamRanking,
): EarnedPairingsResult {
  const ambiguous = ranking.buckets.find(
    (b) => b.chipOffRequired && b.rank <= 4,
  );
  if (ambiguous) {
    return {
      status: "chipOffRequired",
      tiedTeamIds: ambiguous.teamIds,
      affectedSeeds: Array.from(
        { length: ambiguous.teamIds.length },
        (_, i) => ambiguous.rank + i,
      ).filter((seed) => seed <= 4),
    };
  }

  const seedTeam = new Map<number, string>();
  for (const bucket of ranking.buckets) {
    if (bucket.rank <= 4 && bucket.teamIds.length === 1) {
      seedTeam.set(bucket.rank, bucket.teamIds[0]);
    }
  }

  const seed1 = seedTeam.get(1);
  const seed2 = seedTeam.get(2);
  const seed3 = seedTeam.get(3);
  const seed4 = seedTeam.get(4);
  if (!seed1 || !seed2 || !seed3 || !seed4) {
    throw new Error("Unable to determine seeds 1-4 from the given ranking");
  }

  return {
    status: "determined",
    matchups: [
      { seedA: 1, seedB: 2, teamAId: seed1, teamBId: seed2 },
      { seedA: 3, seedB: 4, teamAId: seed3, teamBId: seed4 },
    ],
  };
}
