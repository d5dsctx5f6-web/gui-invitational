// Team standings & the cup. PRODUCT_SPEC §2 "Points" / Addendum A §3 tiebreaker ladder.
// No ties resolved in software: automatic criteria apply in order (points, head-to-head,
// holes won); anything still tied comes back as a chipOffRequired bucket naming the
// tied teams, for the commissioner to resolve on the practice green.

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
  /** 1-based. Ties occupy consecutive ranks — a bucket of 2 at rank 2 also covers rank 3. */
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

/** Points earned strictly between the given teams (their matches against each other only). */
function headToHeadPoints(
  teamIds: string[],
  outcomes: TeamMatchOutcome[],
): Map<string, number> {
  const result = new Map(teamIds.map((id) => [id, 0]));
  for (const o of outcomes) {
    if (teamIds.includes(o.teamAId) && teamIds.includes(o.teamBId)) {
      result.set(o.teamAId, (result.get(o.teamAId) ?? 0) + o.points.a);
      result.set(o.teamBId, (result.get(o.teamBId) ?? 0) + o.points.b);
    }
  }
  return result;
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

  // Head-to-head only cleanly resolves a two-team tie — see Brief 5 session addendum
  // for why 3+ way head-to-head is left unresolved here (falls through to holes won).
  groups = groups.flatMap((group) => {
    if (group.length !== 2) return [group];
    const h2h = headToHeadPoints(group, outcomes);
    const [x, y] = group;
    if (h2h.get(x) === h2h.get(y)) return [group]; // never played, or evenly split
    return splitByValue(group, (id) => h2h.get(id) ?? 0);
  });

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
