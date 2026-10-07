import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMatchHoles,
  type CupInput,
  type CupRoundInput,
  type RoundFormat,
} from "@/engine/src";
import { getCurrentSeason, getQaSeason } from "./season";
import type { Scope } from "./scope";

// Brief 34: ONE loader for everything that shows the Cup (/leaderboard, match detail, /board).
// It runs on the server for the first paint and in the browser for every realtime / interval
// refetch (RLS lets anon and signed-in devices read all of these tables). It returns plain JSON;
// every number the screens show is then derived by the engine — no second scoring path.

export interface CupDuo {
  id: string;
  playerIds: (string | null)[]; // [player 1, player 2 | null]
}

export interface CupMatchData {
  slot: number;
  north: CupDuo | null;
  south: CupDuo | null;
}

export interface CupRoundData {
  id: string;
  /** Plain calendar date (YYYY-MM-DD). */
  date: string;
  roundNumber: number;
  format: RoundFormat;
  courseName: string;
  teeName: string | null;
  firstTeeTime: string | null;
  intervalMinutes: number;
  teeTimeNote: string | null;
  parByHole: number[];
  matches: CupMatchData[];
}

export interface CupData {
  scope: Scope;
  loadedAt: string;
  season: {
    id: string;
    name: string;
    year: number;
    eventShortened: boolean;
    chipOffWinnerSide: "A" | "B" | null;
  } | null;
  rounds: CupRoundData[];
  scrambleRows: { duoId: string; roundId: string; hole: number; strokes: number; teeShotPlayerId: string | null }[];
  bestBallRows: { duoId: string; roundId: string; playerId: string; hole: number; strokes: number }[];
  mulligans: { id: string; duoId: string; roundId: string; hole: number }[];
  playerNames: Record<string, string>;
}

type Row = Record<string, unknown>;

export async function loadCupData(supabase: SupabaseClient, scope: Scope): Promise<CupData> {
  const loadedAt = new Date().toISOString();
  const empty: CupData = {
    scope,
    loadedAt,
    season: null,
    rounds: [],
    scrambleRows: [],
    bestBallRows: [],
    mulligans: [],
    playerNames: {},
  };

  const season = scope === "qa" ? await getQaSeason(supabase) : await getCurrentSeason(supabase);
  if (!season) return empty;

  const { data: seasonExtra } = await supabase
    .from("seasons")
    .select("event_shortened, chip_off_winner_team_id")
    .eq("id", season.id)
    .maybeSingle();

  const [{ data: teams, error: teamsError }, { data: roundRows, error: roundsError }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("season_id", season.id),
    supabase
      .from("rounds")
      .select("id, date, round_number, format, course_id, default_tee_id, first_tee_time, group_interval_minutes, tee_time_note")
      .eq("season_id", season.id)
      .order("round_number"),
  ]);
  if (teamsError || roundsError) throw new Error((teamsError ?? roundsError)!.message);
  const northId = teams?.find((t) => t.name === "North Hedges")?.id as string | undefined;
  const southId = teams?.find((t) => t.name === "South Hedges")?.id as string | undefined;
  const rounds = (roundRows ?? []) as Row[];
  const roundIds = rounds.map((r) => r.id as string);

  const chipOff = (seasonExtra?.chip_off_winner_team_id as string | null | undefined) ?? null;
  const chipOffWinnerSide: "A" | "B" | null = chipOff && chipOff === northId ? "A" : chipOff && chipOff === southId ? "B" : null;

  if (roundIds.length === 0) {
    return {
      ...empty,
      season: { ...season, eventShortened: !!seasonExtra?.event_shortened, chipOffWinnerSide },
    };
  }

  const teeIds = rounds.map((r) => r.default_tee_id as string | null).filter((x): x is string => !!x);
  const courseIds = [...new Set(rounds.map((r) => r.course_id as string))];

  const [duosRes, teesRes, coursesRes, sRes, bRes, mRes] = await Promise.all([
    supabase.from("duos").select("id, round_id, team_id, player_1_id, player_2_id, match_slot").in("round_id", roundIds),
    teeIds.length
      ? supabase.from("course_tees").select("id, tee_name, par_by_hole").in("id", teeIds)
      : Promise.resolve({ data: [] as Row[] }),
    supabase.from("courses").select("id, name").in("id", courseIds),
    supabase.from("hole_scores").select("duo_id, round_id, hole, strokes, tee_shot_used_player_id").in("round_id", roundIds),
    supabase.from("player_hole_scores").select("duo_id, round_id, player_id, hole, strokes").in("round_id", roundIds),
    supabase.from("reverse_mulligans").select("id, duo_id, round_id, hole").in("round_id", roundIds),
  ]);

  for (const res of [duosRes, teesRes, coursesRes, sRes, bRes, mRes]) {
    const err = (res as { error?: { message: string } | null }).error;
    if (err) throw new Error(err.message); // never present a failed read as an empty Cup
  }

  const duos = (duosRes.data ?? []) as Row[];
  const playerIds = [...new Set(duos.flatMap((d) => [d.player_1_id, d.player_2_id]).filter((x): x is string => !!x))];
  const { data: players } = playerIds.length
    ? await supabase.from("players").select("id, name").in("id", playerIds)
    : { data: [] as Row[] };
  const playerNames = Object.fromEntries(((players ?? []) as Row[]).map((p) => [p.id as string, p.name as string]));

  const tees = (teesRes.data ?? []) as Row[];
  const courses = (coursesRes.data ?? []) as Row[];

  const roundsOut: CupRoundData[] = rounds.map((r) => {
    const tee = tees.find((t) => t.id === r.default_tee_id);
    const roundDuos = duos.filter((d) => d.round_id === r.id);
    const slots = [...new Set(roundDuos.map((d) => d.match_slot as number))].sort((a, b) => a - b);
    const toDuo = (d: Row | undefined): CupDuo | null =>
      d ? { id: d.id as string, playerIds: [d.player_1_id as string, (d.player_2_id as string | null) ?? null] } : null;
    return {
      id: r.id as string,
      date: r.date as string,
      roundNumber: (r.round_number as number | null) ?? 0,
      format: r.format as RoundFormat,
      courseName: (courses.find((c) => c.id === r.course_id)?.name as string | undefined) ?? "",
      teeName: (tee?.tee_name as string | undefined) ?? null,
      firstTeeTime: (r.first_tee_time as string | null) ?? null,
      intervalMinutes: r.group_interval_minutes as number,
      teeTimeNote: (r.tee_time_note as string | null) ?? null,
      parByHole: ((tee?.par_by_hole as number[] | null | undefined) ?? Array(18).fill(4)) as number[],
      matches: slots.map((slot) => ({
        slot,
        north: toDuo(roundDuos.find((d) => d.match_slot === slot && d.team_id === northId)),
        south: toDuo(roundDuos.find((d) => d.match_slot === slot && d.team_id === southId)),
      })),
    };
  });

  return {
    scope,
    loadedAt,
    season: { ...season, eventShortened: !!seasonExtra?.event_shortened, chipOffWinnerSide },
    rounds: roundsOut,
    scrambleRows: ((sRes.data ?? []) as Row[]).map((r) => ({
      duoId: r.duo_id as string,
      roundId: r.round_id as string,
      hole: r.hole as number,
      strokes: r.strokes as number,
      teeShotPlayerId: (r.tee_shot_used_player_id as string | null) ?? null,
    })),
    bestBallRows: ((bRes.data ?? []) as Row[]).map((r) => ({
      duoId: r.duo_id as string,
      roundId: r.round_id as string,
      playerId: r.player_id as string,
      hole: r.hole as number,
      strokes: r.strokes as number,
    })),
    mulligans: ((mRes.data ?? []) as Row[]).map((r) => ({
      id: r.id as string,
      duoId: r.duo_id as string,
      roundId: r.round_id as string,
      hole: r.hole as number,
    })),
    playerNames,
  };
}

/** The 18 holes of one match (A = North, B = South) in the round's format — the scoring adapter. */
export function matchHolesFor(data: CupData, round: CupRoundData, match: CupMatchData & { north: CupDuo; south: CupDuo }) {
  return buildMatchHoles({
    format: round.format,
    parByHole: round.parByHole,
    duoAId: match.north.id,
    duoBId: match.south.id,
    scrambleRows: data.scrambleRows.filter((x) => x.roundId === round.id),
    bestBallRows: data.bestBallRows.filter((x) => x.roundId === round.id),
  });
}

/** The engine input for the Cup: a match counts only when BOTH its duos exist. */
export function cupInputFrom(data: CupData): CupInput {
  const rounds: CupRoundInput[] = data.rounds.map((r) => ({
    roundId: r.id,
    roundNumber: r.roundNumber,
    matches: r.matches.flatMap((m) =>
      m.north && m.south
        ? [{ slot: m.slot, holes: matchHolesFor(data, r, { ...m, north: m.north, south: m.south }) }]
        : [],
    ),
  }));
  return {
    rounds,
    eventShortened: data.season?.eventShortened ?? false,
    chipOffWinner: data.season?.chipOffWinnerSide ?? null,
  };
}
