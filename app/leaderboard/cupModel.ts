import {
  cupHeadline,
  cupStandings,
  groupTeeTimeIso,
  matchCardStatus,
  projectedStandings,
  segmentLabel,
  type CupHeadline,
  type CupStandings,
  type DuoHoleScore,
  type MatchCardStatus,
  type MatchState,
  type ProjectedStandings,
  type SegmentLabel,
} from "@/engine/src";
import { cupInputFrom, matchHolesFor, type CupData, type CupDuo } from "@/lib/cupData";
import { formatArizonaTime } from "@/lib/timezone";

// Brief 34: turns the loaded Cup data into exactly what the screens draw. Every number and status
// string comes from the engine (cupStandings / projectedStandings / matchCardStatus / segmentLabel);
// this file only arranges them and attaches names and tee times.

export interface MatchView {
  roundId: string;
  slot: number;
  northNames: string;
  southNames: string;
  northShortHanded: boolean;
  southShortHanded: boolean;
  teeTime: string | null;
  card: MatchCardStatus;
  segments: { label: "F9" | "B9" | "18"; seg: SegmentLabel }[];
  holes: DuoHoleScore[];
  state: MatchState;
}

export interface RoundView {
  id: string;
  roundNumber: number;
  dayLabel: string;
  formatLabel: string;
  courseName: string;
  teeName: string | null;
  decidedPoints: number;
  possiblePoints: number;
  counts: boolean;
  /** Slots where only one side has a duo — shown as "waiting for opponent", never counted. */
  unpairedSlots: number[];
  matches: MatchView[];
}

export interface CupView {
  data: CupData;
  standings: CupStandings;
  projection: ProjectedStandings;
  headline: CupHeadline;
  rounds: RoundView[];
  /** No round has any duo yet — before Pairings Night. */
  beforePairings: boolean;
}

const DAY = (n: number) => (n === 1 ? "Saturday" : n === 2 ? "Sunday" : `Round ${n}`);
export const formatLabel = (f: "scramble" | "best_ball") => (f === "best_ball" ? "Best ball" : "Scramble");

export const namesOf = (duo: CupDuo | null, names: Record<string, string>): string =>
  duo
    ? duo.playerIds
        .filter((id): id is string => !!id)
        .map((id) => names[id] ?? "?")
        .join(" + ")
    : "—";

export function deriveCupView(data: CupData): CupView {
  const input = cupInputFrom(data);
  const standings = cupStandings(input);
  const projection = projectedStandings(input);

  const rounds: RoundView[] = data.rounds.map((r) => {
    const result = standings.rounds.find((x) => x.roundId === r.id);
    const matches: MatchView[] = r.matches.flatMap((m) => {
      if (!m.north || !m.south) return [];
      const holes = matchHolesFor(data, r, { ...m, north: m.north, south: m.south });
      const state = result?.matches.find((x) => x.slot === m.slot)?.state;
      if (!state) return [];
      return [
        {
          roundId: r.id,
          slot: m.slot,
          northNames: namesOf(m.north, data.playerNames),
          southNames: namesOf(m.south, data.playerNames),
          northShortHanded: m.north.playerIds[1] === null,
          southShortHanded: m.south.playerIds[1] === null,
          teeTime: r.firstTeeTime ? formatArizonaTime(groupTeeTimeIso(r.firstTeeTime, r.intervalMinutes, m.slot)) : null,
          card: matchCardStatus(state),
          segments: [
            { label: "F9" as const, seg: segmentLabel(state.front9) },
            { label: "B9" as const, seg: segmentLabel(state.back9) },
            { label: "18" as const, seg: segmentLabel(state.overall18) },
          ],
          holes,
          state,
        },
      ];
    });
    return {
      id: r.id,
      roundNumber: r.roundNumber,
      dayLabel: DAY(r.roundNumber),
      formatLabel: formatLabel(r.format),
      courseName: r.courseName,
      teeName: r.teeName,
      decidedPoints: result?.decidedPoints ?? 0,
      possiblePoints: result?.possiblePoints ?? 0,
      counts: result?.counts ?? true,
      unpairedSlots: r.matches.filter((m) => !(m.north && m.south)).map((m) => m.slot),
      matches,
    };
  });

  return {
    data,
    standings,
    projection,
    headline: cupHeadline(standings),
    rounds,
    beforePairings: data.rounds.every((r) => r.matches.length === 0),
  };
}

/** Which round the shortened-event banner says the standings are "after". */
export function shortenedAfterLabel(view: CupView): string {
  const last = view.standings.countedRoundNumbers.at(-1);
  return last ? DAY(last) : "—";
}
