// Team standings & the cup. PRODUCT_SPEC_V2 §2 "Points": North Hedges vs South Hedges, a
// two-way points tally, not four-way. No head-to-head tiebreaker step — with exactly two teams
// who only ever play each other, total points *is* their head-to-head record; a separate step
// for it would be redundant, not just simpler (Brief 31 Part B). Tiebreak ladder collapses to:
// points → total holes won → flag for chip-off. No ties resolved in software beyond that:
// anything still tied comes back as a chipOffRequired bucket for the commissioner to resolve
// on the practice green — `seasons.chip_off_winner_team_id` gets set by admin after the fact.

export interface TeamMatchOutcome {
  teamAId: string;
  teamBId: string;
  points: { a: number; b: number };
  holesWon: { a: number; b: number };
}

export interface TeamTotals {
  teamId: string;
  points: number;
  holesWon: number;
}

export interface RankBucket {
  /** 1-based. Ties occupy consecutive ranks — a bucket of 2 at rank 1 also covers rank 2. */
  rank: number;
  teamIds: string[];
  chipOffRequired: boolean;
}

export interface TeamRanking {
  /** Best to worst. */
  buckets: RankBucket[];
  totals: TeamTotals[];
}

function computeTotals(
  teamIds: string[],
  outcomes: TeamMatchOutcome[],
): TeamTotals[] {
  return teamIds.map((teamId) => {
    let points = 0;
    let holesWon = 0;
    for (const o of outcomes) {
      if (o.teamAId === teamId) {
        points += o.points.a;
        holesWon += o.holesWon.a;
      } else if (o.teamBId === teamId) {
        points += o.points.b;
        holesWon += o.holesWon.b;
      }
    }
    return { teamId, points, holesWon };
  });
}

/** Splits a group into ordered sub-groups by descending value; equal values stay together. */
function splitByValue(ids: string[], valueFor: (id: string) => number): string[][] {
  const sorted = [...ids].sort((a, b) => valueFor(b) - valueFor(a));
  const groups: string[][] = [];
  for (const id of sorted) {
    const last = groups[groups.length - 1];
    if (last && valueFor(last[0]) === valueFor(id)) {
      last.push(id);
    } else {
      groups.push([id]);
    }
  }
  return groups;
}

export function rankTeams(
  teamIds: string[],
  outcomes: TeamMatchOutcome[],
): TeamRanking {
  const totals = computeTotals(teamIds, outcomes);
  const totalsById = new Map(totals.map((t) => [t.teamId, t]));

  let groups = splitByValue(teamIds, (id) => totalsById.get(id)!.points);

  groups = groups.flatMap((group) => {
    if (group.length <= 1) return [group];
    return splitByValue(group, (id) => totalsById.get(id)!.holesWon);
  });

  const buckets: RankBucket[] = [];
  let rank = 1;
  for (const group of groups) {
    buckets.push({ rank, teamIds: group, chipOffRequired: group.length > 1 });
    rank += group.length;
  }

  return { buckets, totals };
}
