import {
  addTeamMember,
  adminLogin,
  adminLogout,
  correctHoleScore,
  createCourse,
  createRound,
  createScheduleItem,
  createTeam,
  deleteChallengeBet,
  deleteCourse,
  deleteMatch,
  deleteRound,
  deleteScheduleItem,
  deleteTeam,
  reassignChallengeBetWinner,
  removeReverseMulligan,
  removeSkinsEntry,
  removeTeamMember,
  resetDuoSubmission,
  resetPlayerPin,
  setDuoSubmission,
  setSeasonTrophies,
  setSkinsBuyIn,
  updatePlayerIndex,
  updateScheduleItem,
  updateTeam,
  upsertCourseTee,
  upsertMatch,
  voidChallengeBet,
} from "./actions";
import Link from "next/link";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { buildDeleteWarning } from "./deleteWarnings";
import styles from "./admin.module.css";
import pageStyles from "../page.module.css";
import { isAdminAuthed } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Player {
  id: string;
  name: string;
  index: number | null;
}
interface Team {
  id: string;
  name: string;
  captain_player_id: string | null;
}
interface TeamMember {
  team_id: string;
  player_id: string;
}
interface Round {
  id: string;
  date: string;
  format: string;
  course_id: string;
  default_tee_id: string | null;
  skins_buy_in: number | null;
}
interface Match {
  id: string;
  round_id: string;
  team_a_id: string;
  team_b_id: string;
  slot: string;
}
interface Course {
  id: string;
  name: string;
}
interface CourseTee {
  id: string;
  course_id: string;
  tee_name: string;
  rating: number;
  slope: number;
  par: number;
  stroke_index: number[];
  par_by_hole: number[] | null;
  yardage_by_hole: number[] | null;
}
interface HoleScoreRow {
  id: string;
  player_id: string;
  round_id: string;
  hole: number;
  strokes: number;
  match_strokes: number | null;
  breakfast_ball: boolean;
  mulligan: boolean;
}
interface ChallengeBet {
  id: string;
  proposer_id: string;
  acceptor_id: string | null;
  terms: string;
  stake: number | null;
  status: string;
  winner_player_id: string | null;
}
interface Season {
  id: string;
  year: number;
  name: string;
  cup_winner_team_id: string | null;
  individual_champion_player_id: string | null;
  skins_king_player_id: string | null;
}
interface ScheduleItem {
  id: string;
  season_id: string;
  title: string;
  starts_at: string | null;
  notes: string | null;
}
interface ReverseMulligan {
  id: string;
  team_id: string;
  round_id: string;
  hole: number;
  victim_player_id: string;
  original_holed_score: number | null;
}
interface SkinsEntry {
  id: string;
  player_id: string;
  round_id: string;
}
interface DuoSubmissionRow {
  id: string;
  round_id: string;
  team_id: string;
  captain_player_id: string;
  duo_a_player_1: string;
  duo_a_player_2: string | null;
  duo_b_player_1: string | null;
  duo_b_player_2: string | null;
  committed_at: string | null;
}

async function loadAdminData() {
  const supabase = await createClient();
  const [
    players,
    teams,
    teamMembers,
    rounds,
    matches,
    courses,
    courseTees,
    challengeBets,
    seasonsCore,
    scheduleItems,
    reverseMulligans,
    skinsEntries,
    holeScoreRoundIds,
    duoSubmissions,
  ] = await Promise.all([
    supabase.from("players").select("id, name, index").order("name"),
    supabase.from("teams").select("id, name, captain_player_id").order("name"),
    supabase.from("team_members").select("team_id, player_id"),
    supabase.from("rounds").select("id, date, format, course_id, default_tee_id").order("date"),
    supabase.from("matches").select("id, round_id, team_a_id, team_b_id, slot"),
    supabase.from("courses").select("id, name").order("name"),
    supabase
      .from("course_tees")
      .select("id, course_id, tee_name, rating, slope, par, stroke_index, par_by_hole, yardage_by_hole"),
    supabase
      .from("challenge_bets")
      .select("id, proposer_id, acceptor_id, terms, stake, status, winner_player_id"),
    supabase.from("seasons").select("id, year, name").order("year", { ascending: false }),
    supabase
      .from("schedule_items")
      .select("id, season_id, title, starts_at, notes")
      .order("starts_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("reverse_mulligans")
      .select("id, team_id, round_id, hole, victim_player_id, original_holed_score"),
    supabase.from("skins_entries").select("id, player_id, round_id"),
    // Lightweight FK-only fetch purely for the delete-confirmation dependency counts below
    // (Brief 9 Part A) — hole_scores can run into the hundreds but is trivial as just round_id.
    supabase.from("hole_scores").select("round_id"),
    // Full rows (Brief 13 Part C: admin's own duo-submissions view/set/reset needs every
    // field, not just the round_id/team_id used for dependency counts) — still tiny, at most
    // one row per team per round.
    supabase
      .from("duo_submissions")
      .select(
        "id, round_id, team_id, captain_player_id, duo_a_player_1, duo_a_player_2, duo_b_player_1, duo_b_player_2, committed_at",
      ),
  ]);

  // Fetched separately from the core round fields above: if 0019 (skins_buy_in) hasn't run
  // yet on this database, this query alone fails and falls back to "unset" everywhere —
  // it must never take down Matchups/Corrections, which only need the fields above.
  const { data: buyIns } = await supabase.from("rounds").select("id, skins_buy_in");
  const buyInByRoundId = new Map<string, number | null>(
    (buyIns ?? []).map((r) => [r.id, r.skins_buy_in]),
  );

  const roundsList = (rounds.data ?? []).map((r) => ({
    ...r,
    skins_buy_in: buyInByRoundId.get(r.id) ?? null,
  })) as Round[];

  // Same reasoning as skins_buy_in above: fetched separately so a database that hasn't run
  // 0020 (the trophy columns) yet still shows the rest of the season list intact.
  const { data: trophies } = await supabase
    .from("seasons")
    .select("id, cup_winner_team_id, individual_champion_player_id, skins_king_player_id");
  const trophiesBySeasonId = new Map(
    (trophies ?? []).map((t) => [
      t.id,
      {
        cup_winner_team_id: t.cup_winner_team_id,
        individual_champion_player_id: t.individual_champion_player_id,
        skins_king_player_id: t.skins_king_player_id,
      },
    ]),
  );
  const seasonsList = (seasonsCore.data ?? []).map((s) => ({
    ...s,
    cup_winner_team_id: trophiesBySeasonId.get(s.id)?.cup_winner_team_id ?? null,
    individual_champion_player_id:
      trophiesBySeasonId.get(s.id)?.individual_champion_player_id ?? null,
    skins_king_player_id: trophiesBySeasonId.get(s.id)?.skins_king_player_id ?? null,
  })) as Season[];

  // Dependency counts for the delete-confirmation warnings (Brief 9 Part A). All built from
  // already-fetched lightweight FK lists — no per-row queries.
  function countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
    const map = new Map<string, number>();
    for (const row of rows) {
      const k = key(row);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }

  const matchesByRound = countBy(matches.data ?? [], (m) => m.round_id);
  const holeScoresByRound = countBy(holeScoreRoundIds.data ?? [], (r) => r.round_id);
  const duoSubsByRound = countBy(duoSubmissions.data ?? [], (d) => d.round_id);
  const duoSubsByTeam = countBy(duoSubmissions.data ?? [], (d) => d.team_id);
  const skinsEntriesByRound = countBy(skinsEntries.data ?? [], (s) => s.round_id);
  const rmByRound = countBy(reverseMulligans.data ?? [], (r) => r.round_id);
  const rmByTeam = countBy(reverseMulligans.data ?? [], (r) => r.team_id);
  const teeSetupsByCourse = countBy(courseTees.data ?? [], (t) => t.course_id);
  const roundsByCourse = countBy(rounds.data ?? [], (r) => r.course_id);
  const teamMembersByTeam = countBy(teamMembers.data ?? [], (m) => m.team_id);
  const matchesByTeam = countBy(
    (matches.data ?? []).flatMap((m) => [m.team_a_id, m.team_b_id]),
    (teamId) => teamId,
  );

  return {
    players: (players.data ?? []) as Player[],
    teams: (teams.data ?? []) as Team[],
    teamMembers: (teamMembers.data ?? []) as TeamMember[],
    rounds: roundsList,
    matches: (matches.data ?? []) as Match[],
    courses: (courses.data ?? []) as Course[],
    courseTees: (courseTees.data ?? []) as CourseTee[],
    challengeBets: (challengeBets.data ?? []) as ChallengeBet[],
    seasons: seasonsList,
    scheduleItems: (scheduleItems.data ?? []) as ScheduleItem[],
    reverseMulligans: (reverseMulligans.data ?? []) as ReverseMulligan[],
    skinsEntries: (skinsEntries.data ?? []) as SkinsEntry[],
    duoSubmissions: (duoSubmissions.data ?? []) as DuoSubmissionRow[],
    dependencyCounts: {
      matchesByRound,
      holeScoresByRound,
      duoSubsByRound,
      duoSubsByTeam,
      skinsEntriesByRound,
      rmByRound,
      rmByTeam,
      teeSetupsByCourse,
      roundsByCourse,
      teamMembersByTeam,
      matchesByTeam,
    },
  };
}

async function loadHoleScores(roundId: string | undefined) {
  if (!roundId) return [] as HoleScoreRow[];
  const supabase = await createClient();
  const { data } = await supabase
    .from("hole_scores")
    .select("id, player_id, round_id, hole, strokes, match_strokes, breakfast_ball, mulligan")
    .eq("round_id", roundId)
    .order("hole");
  return (data ?? []) as HoleScoreRow[];
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const authed = await isAdminAuthed();

  if (!authed) {
    return (
      <main className={styles.page}>
        <Link href="/" className={pageStyles.backLink}>
          ← Home
        </Link>
        <form action={adminLogin} className={styles.gate}>
          <div className={styles.title}>Commissioner</div>
          {params.err && <div className={styles.flashErr}>{params.err}</div>}
          <input
            className={styles.gateInput}
            type="password"
            name="passcode"
            placeholder="Passcode"
            autoFocus
          />
          <button className={styles.gateSubmit} type="submit">
            Enter
          </button>
        </form>
      </main>
    );
  }

  const {
    players,
    teams,
    teamMembers,
    rounds,
    matches,
    courses,
    courseTees,
    challengeBets,
    seasons,
    scheduleItems,
    reverseMulligans,
    skinsEntries,
    duoSubmissions,
    dependencyCounts: dc,
  } = await loadAdminData();
  const selectedRoundId = params.round ?? rounds[0]?.id;
  const holeScores = await loadHoleScores(selectedRoundId);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";
  const courseNameForRound = (round: Round) => courseName(courses, round.course_id);
  const roundLabel = (round: Round) => `${courseNameForRound(round)} — ${formatName(round.format)}`;

  function toDatetimeLocal(value: string | null): string {
    if (!value) return "";
    const d = new Date(value);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function courseDeleteWarning(courseId: string, name: string): string {
    return buildDeleteWarning(`"${name}"`, {
      teeSetups: dc.teeSetupsByCourse.get(courseId) ?? 0,
      rounds: dc.roundsByCourse.get(courseId) ?? 0,
      matches: (rounds.filter((r) => r.course_id === courseId)).reduce(
        (sum, r) => sum + (dc.matchesByRound.get(r.id) ?? 0),
        0,
      ),
      holeScores: rounds
        .filter((r) => r.course_id === courseId)
        .reduce((sum, r) => sum + (dc.holeScoresByRound.get(r.id) ?? 0), 0),
      duoSubmissions: rounds
        .filter((r) => r.course_id === courseId)
        .reduce((sum, r) => sum + (dc.duoSubsByRound.get(r.id) ?? 0), 0),
      skinsEntries: rounds
        .filter((r) => r.course_id === courseId)
        .reduce((sum, r) => sum + (dc.skinsEntriesByRound.get(r.id) ?? 0), 0),
      reverseMulligans: rounds
        .filter((r) => r.course_id === courseId)
        .reduce((sum, r) => sum + (dc.rmByRound.get(r.id) ?? 0), 0),
    });
  }

  function roundDeleteWarning(round: Round): string {
    return buildDeleteWarning(`"${roundLabel(round)}"`, {
      matches: dc.matchesByRound.get(round.id) ?? 0,
      holeScores: dc.holeScoresByRound.get(round.id) ?? 0,
      duoSubmissions: dc.duoSubsByRound.get(round.id) ?? 0,
      skinsEntries: dc.skinsEntriesByRound.get(round.id) ?? 0,
      reverseMulligans: dc.rmByRound.get(round.id) ?? 0,
    });
  }

  function teamDeleteWarning(teamId: string, name: string): string {
    return buildDeleteWarning(`"${name}"`, {
      teamMembers: dc.teamMembersByTeam.get(teamId) ?? 0,
      matches: dc.matchesByTeam.get(teamId) ?? 0,
      duoSubmissions: dc.duoSubsByTeam.get(teamId) ?? 0,
      reverseMulligans: dc.rmByTeam.get(teamId) ?? 0,
    });
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <Link href="/" className={pageStyles.backLink}>
            ← Home
          </Link>
          <div className={styles.title}>Commissioner</div>
        </div>
        <form action={adminLogout}>
          <button className={styles.logout} type="submit">
            Log out
          </button>
        </form>
      </div>

      {params.msg && <div className={styles.flashOk}>{params.msg}</div>}
      {params.err && <div className={styles.flashErr}>{params.err}</div>}

      {/* ---------------- Teams ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Teams</div>
        {teams.map((team) => {
          const members = teamMembers.filter((m) => m.team_id === team.id);
          const memberIds = new Set(members.map((m) => m.player_id));
          const available = players.filter((p) => !memberIds.has(p.id));
          return (
            <div key={team.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <form action={updateTeam} className={styles.inlineForm}>
                <input type="hidden" name="teamId" value={team.id} />
                <input className={styles.input} name="name" defaultValue={team.name} />
                <select className={styles.select} name="captainPlayerId" defaultValue={team.captain_player_id ?? ""}>
                  <option value="">No captain</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className={styles.btn} type="submit">
                  Save
                </button>
              </form>
              <form action={deleteTeam}>
                <input type="hidden" name="teamId" value={team.id} />
                <ConfirmDeleteButton
                  className={styles.btnDanger}
                  confirmMessage={teamDeleteWarning(team.id, team.name)}
                >
                  Delete team
                </ConfirmDeleteButton>
              </form>
              <div className={styles.hint}>
                {members.length === 0
                  ? "No members yet"
                  : members
                      .map((m) => playerName(m.player_id))
                      .join(", ")}
              </div>
              <div className={styles.inlineForm}>
                {members.map((m) => (
                  <form key={m.player_id} action={removeTeamMember}>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input type="hidden" name="playerId" value={m.player_id} />
                    <button className={styles.btnGhost} type="submit">
                      − {playerName(m.player_id)}
                    </button>
                  </form>
                ))}
              </div>
              {available.length > 0 && (
                <form action={addTeamMember} className={styles.inlineForm}>
                  <input type="hidden" name="teamId" value={team.id} />
                  <select className={styles.select} name="playerId" defaultValue="">
                    <option value="" disabled>
                      Add player…
                    </option>
                    {available.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button className={styles.btn} type="submit">
                    Add
                  </button>
                </form>
              )}
            </div>
          );
        })}
        <form action={createTeam} className={styles.inlineForm}>
          <input className={styles.input} name="name" placeholder="New team name" />
          <button className={styles.btn} type="submit">
            Create team
          </button>
        </form>
      </section>

      {/* ---------------- Rounds + Matchups ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Rounds &amp; matchups</div>
        {rounds.map((round) => {
          const roundMatches = matches.filter((m) => m.round_id === round.id);
          return (
            <div key={round.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className={styles.inlineForm} style={{ justifyContent: "space-between" }}>
                <div className={styles.hint}>
                  <b style={{ color: "var(--cream)" }}>{roundLabel(round)}</b>
                  <span> · {round.date}</span>
                </div>
                <form action={deleteRound}>
                  <input type="hidden" name="roundId" value={round.id} />
                  <ConfirmDeleteButton
                    className={styles.btnDanger}
                    confirmMessage={roundDeleteWarning(round)}
                  >
                    Delete round
                  </ConfirmDeleteButton>
                </form>
              </div>
              <form action={setSkinsBuyIn} className={styles.inlineForm}>
                <input type="hidden" name="roundId" value={round.id} />
                <span className={styles.hint}>Skins buy-in ($):</span>
                <input
                  className={styles.input}
                  type="number"
                  step="1"
                  name="skinsBuyIn"
                  defaultValue={round.skins_buy_in ?? ""}
                  placeholder="TBD"
                />
                <button className={styles.btn} type="submit">
                  Save
                </button>
              </form>
              {roundMatches.map((m) => (
                <div key={m.id} className={styles.inlineForm}>
                  <form action={upsertMatch} className={styles.inlineForm}>
                    <input type="hidden" name="matchId" value={m.id} />
                    <input type="hidden" name="roundId" value={round.id} />
                    <select className={styles.select} name="teamAId" defaultValue={m.team_a_id}>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <span className={styles.hint}>vs</span>
                    <select className={styles.select} name="teamBId" defaultValue={m.team_b_id}>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <select className={styles.select} name="slot" defaultValue={m.slot}>
                      <option value="A">Slot A</option>
                      <option value="B">Slot B</option>
                    </select>
                    <button className={styles.btn} type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteMatch}>
                    <input type="hidden" name="matchId" value={m.id} />
                    <ConfirmDeleteButton
                      className={styles.btnDanger}
                      confirmMessage="Remove this matchup? This cannot be undone."
                    >
                      Remove
                    </ConfirmDeleteButton>
                  </form>
                </div>
              ))}
              <form action={upsertMatch} className={styles.inlineForm}>
                <input type="hidden" name="roundId" value={round.id} />
                <select className={styles.select} name="teamAId" defaultValue="">
                  <option value="" disabled>
                    Team A
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select className={styles.select} name="teamBId" defaultValue="">
                  <option value="" disabled>
                    Team B
                  </option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <select className={styles.select} name="slot" defaultValue="A">
                  <option value="A">Slot A</option>
                  <option value="B">Slot B</option>
                </select>
                <button className={styles.btn} type="submit">
                  Add matchup
                </button>
              </form>
            </div>
          );
        })}

        <div className={styles.hint}>Add a round:</div>
        <form action={createRound} className={styles.inlineForm}>
          <input className={styles.input} type="date" name="date" />
          <select className={styles.select} name="format" defaultValue="shamble">
            <option value="shamble">Shamble</option>
            <option value="four_ball">Four-ball</option>
          </select>
          <select className={styles.select} name="courseId" defaultValue="">
            <option value="" disabled>
              Course
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className={styles.select} name="teeId" defaultValue="">
            <option value="">No default tee</option>
            {courseTees.map((t) => (
              <option key={t.id} value={t.id}>
                {courseName(courses, t.course_id)} — {t.tee_name}
              </option>
            ))}
          </select>
          <button className={styles.btn} type="submit">
            Create round
          </button>
        </form>
      </section>

      {/* ---------------- Duo submissions (Brief 13 Part C) ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Duo submissions</div>
        <div className={styles.hint}>
          Commissioner override — shows and edits both teams&apos; lineups regardless of the
          blind-until-both-reveal rule captains see on /duos. Intentional, not a bug.
        </div>
        <div className={styles.hint}>Round:</div>
        <RoundPicker rounds={rounds} courses={courses} selected={selectedRoundId} />
        {!selectedRoundId && <div className={styles.hint}>No rounds yet.</div>}
        {selectedRoundId &&
          teams.map((team) => {
            const roster = teamMembers
              .filter((m) => m.team_id === team.id)
              .map((m) => players.find((p) => p.id === m.player_id))
              .filter((p): p is Player => p !== undefined);
            const sub = duoSubmissions.find(
              (d) => d.round_id === selectedRoundId && d.team_id === team.id,
            );
            return (
              <div
                key={team.id}
                className={styles.row}
                style={{ flexDirection: "column", alignItems: "stretch" }}
              >
                <div className={styles.inlineForm} style={{ justifyContent: "space-between" }}>
                  <div className={styles.hint}>
                    <b style={{ color: "var(--cream)" }}>{team.name}</b>
                    {sub ? " · submitted" : " · not yet submitted"}
                  </div>
                  {sub && (
                    <form action={resetDuoSubmission}>
                      <input type="hidden" name="roundId" value={selectedRoundId} />
                      <input type="hidden" name="teamId" value={team.id} />
                      <ConfirmDeleteButton
                        className={styles.btnDanger}
                        confirmMessage={`Reset ${team.name}'s duo submission for this round? They'll need to submit again.`}
                      >
                        Reset
                      </ConfirmDeleteButton>
                    </form>
                  )}
                </div>
                <form action={setDuoSubmission} className={styles.inlineForm}>
                  <input type="hidden" name="roundId" value={selectedRoundId} />
                  <input type="hidden" name="teamId" value={team.id} />
                  <input
                    type="hidden"
                    name="captainPlayerId"
                    value={sub?.captain_player_id ?? team.captain_player_id ?? ""}
                  />
                  <span className={styles.hint}>Duo A:</span>
                  <select className={styles.select} name="duoAPlayer1" defaultValue={sub?.duo_a_player_1 ?? ""}>
                    <option value="" disabled>
                      Player 1
                    </option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select className={styles.select} name="duoAPlayer2" defaultValue={sub?.duo_a_player_2 ?? ""}>
                    <option value="">— none —</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className={styles.hint}>Duo B:</span>
                  <select className={styles.select} name="duoBPlayer1" defaultValue={sub?.duo_b_player_1 ?? ""}>
                    <option value="">— none —</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select className={styles.select} name="duoBPlayer2" defaultValue={sub?.duo_b_player_2 ?? ""}>
                    <option value="">— none —</option>
                    {roster.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button className={styles.btn} type="submit">
                    Save lineup
                  </button>
                </form>
              </div>
            );
          })}
      </section>

      {/* ---------------- Indexes ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Handicap indexes</div>
        {players.map((p) => (
          <div key={p.id} className={styles.row}>
            <span>{p.name}</span>
            <span className={styles.inlineForm}>
              <form action={updatePlayerIndex} className={styles.inlineForm}>
                <input type="hidden" name="playerId" value={p.id} />
                <input
                  className={styles.input}
                  type="number"
                  step="0.1"
                  name="index"
                  defaultValue={p.index ?? ""}
                />
                <button className={styles.btn} type="submit">
                  Save
                </button>
              </form>
              <form action={resetPlayerPin}>
                <input type="hidden" name="playerId" value={p.id} />
                <button className={styles.btnGhost} type="submit">
                  Reset PIN
                </button>
              </form>
            </span>
          </div>
        ))}
      </section>

      {/* ---------------- Course setups ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Course setups</div>
        {courses.map((course) => (
          <div key={course.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className={styles.inlineForm} style={{ justifyContent: "space-between" }}>
              <div className={styles.hint}>
                <b style={{ color: "var(--cream)" }}>{course.name}</b>
              </div>
              <form action={deleteCourse}>
                <input type="hidden" name="courseId" value={course.id} />
                <ConfirmDeleteButton
                  className={styles.btnDanger}
                  confirmMessage={courseDeleteWarning(course.id, course.name)}
                >
                  Delete course
                </ConfirmDeleteButton>
              </form>
            </div>
            {courseTees
              .filter((t) => t.course_id === course.id)
              .map((tee) => (
                <CourseTeeForm key={tee.id} courseId={course.id} tee={tee} />
              ))}
            <CourseTeeForm courseId={course.id} tee={null} />
          </div>
        ))}
        <form action={createCourse} className={styles.inlineForm}>
          <input className={styles.input} name="name" placeholder="New course name" />
          <button className={styles.btn} type="submit">
            Create course
          </button>
        </form>
      </section>

      {/* ---------------- Corrections ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Corrections</div>
        <div className={styles.hint}>Round:</div>
        <RoundPicker rounds={rounds} courses={courses} selected={selectedRoundId} />
        {holeScores.length === 0 && (
          <div className={styles.hint}>No hole scores posted yet for this round.</div>
        )}
        {holeScores.map((row) => (
          <form key={row.id} action={correctHoleScore} className={styles.row}>
            <input type="hidden" name="id" value={row.id} />
            <span>
              {playerName(row.player_id)} · hole {row.hole}
            </span>
            <span className={styles.inlineForm}>
              <input
                className={styles.input}
                type="number"
                name="strokes"
                defaultValue={row.strokes}
                title="Real strokes"
              />
              <input
                className={styles.input}
                type="number"
                name="matchStrokes"
                defaultValue={row.match_strokes ?? ""}
                placeholder="RM match #"
                title="Match-only strokes (reverse mulligan)"
              />
              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="breakfastBall" defaultChecked={row.breakfast_ball} /> BB
              </label>
              <label className={styles.checkboxLabel}>
                <input type="checkbox" name="mulligan" defaultChecked={row.mulligan} /> Mull
              </label>
              <button className={styles.btn} type="submit">
                Save
              </button>
            </span>
          </form>
        ))}
      </section>

      {/* ---------------- Challenge Ledger ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Challenge Ledger — dispute/void/reassign</div>
        {challengeBets.length === 0 && (
          <div className={styles.hint}>No bets logged yet.</div>
        )}
        {challengeBets.map((bet) => (
          <div key={bet.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className={styles.hint}>
              <b style={{ color: "var(--cream)" }}>
                {playerName(bet.proposer_id)} v {playerName(bet.acceptor_id ?? "")}
              </b>
              {" · "}
              {bet.stake !== null ? `$${bet.stake}` : "no stake"} · {bet.terms} ·{" "}
              <b style={{ color: "var(--gold)" }}>{bet.status}</b>
              {bet.winner_player_id && ` · winner: ${playerName(bet.winner_player_id)}`}
            </div>
            <div className={styles.inlineForm}>
              <form action={reassignChallengeBetWinner} className={styles.inlineForm}>
                <input type="hidden" name="id" value={bet.id} />
                <select className={styles.select} name="winnerPlayerId" defaultValue={bet.winner_player_id ?? ""}>
                  <option value="">No winner (reopen)</option>
                  {[bet.proposer_id, bet.acceptor_id].filter(Boolean).map((pid) => (
                    <option key={pid} value={pid!}>
                      {playerName(pid!)}
                    </option>
                  ))}
                </select>
                <button className={styles.btn} type="submit">
                  Set winner
                </button>
              </form>
              {bet.status !== "void" && (
                <form action={voidChallengeBet}>
                  <input type="hidden" name="id" value={bet.id} />
                  <button className={styles.btnDanger} type="submit">
                    Void
                  </button>
                </form>
              )}
              <form action={deleteChallengeBet}>
                <input type="hidden" name="id" value={bet.id} />
                <ConfirmDeleteButton
                  className={styles.btnDanger}
                  confirmMessage={`Delete this bet between ${playerName(bet.proposer_id)} and ${playerName(bet.acceptor_id ?? "")}? This cannot be undone.`}
                >
                  Delete
                </ConfirmDeleteButton>
              </form>
            </div>
          </div>
        ))}
      </section>

      {/* ---------------- Reverse mulligans (Brief 9 Part E) ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Reverse mulligans</div>
        {reverseMulligans.length === 0 && (
          <div className={styles.hint}>None called yet.</div>
        )}
        {reverseMulligans.map((rm) => {
          const round = rounds.find((r) => r.id === rm.round_id);
          return (
            <div key={rm.id} className={styles.row}>
              <span className={styles.hint}>
                {teamName(teams, rm.team_id)} on {playerName(rm.victim_player_id)} · hole{" "}
                {rm.hole} · {round ? roundLabel(round) : "?"}
                {rm.original_holed_score !== null &&
                  ` · real score ${rm.original_holed_score} stands`}
              </span>
              <form action={removeReverseMulligan}>
                <input type="hidden" name="id" value={rm.id} />
                <ConfirmDeleteButton
                  className={styles.btnDanger}
                  confirmMessage="Remove this reverse mulligan? The affected hole reverts to its real score for match play too. This cannot be undone."
                >
                  Remove
                </ConfirmDeleteButton>
              </form>
            </div>
          );
        })}
      </section>

      {/* ---------------- Skins entries (Brief 9 Part G override) ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Skins entries</div>
        {skinsEntries.length === 0 && (
          <div className={styles.hint}>No one opted in yet.</div>
        )}
        {skinsEntries.map((entry) => {
          const round = rounds.find((r) => r.id === entry.round_id);
          return (
            <div key={entry.id} className={styles.row}>
              <span className={styles.hint}>
                {playerName(entry.player_id)} · {round ? roundLabel(round) : "?"}
              </span>
              <form action={removeSkinsEntry}>
                <input type="hidden" name="id" value={entry.id} />
                <ConfirmDeleteButton
                  className={styles.btnDanger}
                  confirmMessage={`Remove ${playerName(entry.player_id)}'s skins opt-in for this round? This cannot be undone.`}
                >
                  Remove
                </ConfirmDeleteButton>
              </form>
            </div>
          );
        })}
      </section>

      {/* ---------------- Schedule ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Schedule</div>
        {scheduleItems.length === 0 && (
          <div className={styles.hint}>No schedule items yet.</div>
        )}
        {scheduleItems.map((item) => (
          <div key={item.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <form action={updateScheduleItem} className={styles.inlineForm}>
              <input type="hidden" name="id" value={item.id} />
              <input className={styles.input} name="title" defaultValue={item.title} style={{ width: 160 }} />
              <input
                className={styles.input}
                type="datetime-local"
                name="startsAt"
                defaultValue={toDatetimeLocal(item.starts_at)}
              />
              <input
                className={styles.input}
                name="notes"
                defaultValue={item.notes ?? ""}
                placeholder="Notes"
                style={{ width: 160 }}
              />
              <button className={styles.btn} type="submit">
                Save
              </button>
            </form>
            <form action={deleteScheduleItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className={styles.btnDanger} type="submit">
                Remove
              </button>
            </form>
          </div>
        ))}

        <div className={styles.hint}>Add a schedule item:</div>
        <form action={createScheduleItem} className={styles.inlineForm}>
          <select className={styles.select} name="seasonId" defaultValue={seasons[0]?.id ?? ""}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input className={styles.input} name="title" placeholder="Title" style={{ width: 160 }} />
          <input className={styles.input} type="datetime-local" name="startsAt" />
          <input className={styles.input} name="notes" placeholder="Notes (optional)" style={{ width: 160 }} />
          <button className={styles.btn} type="submit">
            Add item
          </button>
        </form>
      </section>

      {/* ---------------- Champions wall ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Champions wall</div>
        {seasons.map((season) => (
          <form
            key={season.id}
            action={setSeasonTrophies}
            className={styles.row}
            style={{ flexDirection: "column", alignItems: "stretch" }}
          >
            <input type="hidden" name="seasonId" value={season.id} />
            <div className={styles.hint}>
              <b style={{ color: "var(--cream)" }}>{season.name}</b>
            </div>
            <div className={styles.inlineForm}>
              <span className={styles.hint}>The Cup:</span>
              <select className={styles.select} name="cupWinnerTeamId" defaultValue={season.cup_winner_team_id ?? ""}>
                <option value="">— in play —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.inlineForm}>
              <span className={styles.hint}>Low Man:</span>
              <select
                className={styles.select}
                name="individualChampionPlayerId"
                defaultValue={season.individual_champion_player_id ?? ""}
              >
                <option value="">— in play —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.inlineForm}>
              <span className={styles.hint}>Skins King:</span>
              <select
                className={styles.select}
                name="skinsKingPlayerId"
                defaultValue={season.skins_king_player_id ?? ""}
              >
                <option value="">— in play —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <button className={styles.btn} type="submit">
              Save
            </button>
          </form>
        ))}
      </section>
    </main>
  );
}

function courseName(courses: Course[], courseId: string) {
  return courses.find((c) => c.id === courseId)?.name ?? "?";
}

function teamName(teams: Team[], teamId: string) {
  return teams.find((t) => t.id === teamId)?.name ?? "?";
}

function formatName(format: string) {
  return format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
}

function RoundPicker({
  rounds,
  courses,
  selected,
}: {
  rounds: Round[];
  courses: Course[];
  selected: string | undefined;
}) {
  return (
    <div className={styles.inlineForm}>
      {rounds.map((r) => (
        <a
          key={r.id}
          href={`/admin?round=${r.id}`}
          className={r.id === selected ? styles.btn : styles.btnGhost}
        >
          {courseName(courses, r.course_id)} — {formatName(r.format)}
          <span className={styles.hint}> · {r.date}</span>
        </a>
      ))}
    </div>
  );
}

function CourseTeeForm({ courseId, tee }: { courseId: string; tee: CourseTee | null }) {
  return (
    <form action={upsertCourseTee} className={styles.inlineForm} style={{ alignItems: "flex-start" }}>
      {tee && <input type="hidden" name="teeId" value={tee.id} />}
      <input type="hidden" name="courseId" value={courseId} />
      <input
        className={styles.input}
        name="teeName"
        placeholder="Tee (e.g. White)"
        defaultValue={tee?.tee_name ?? ""}
        style={{ width: 90 }}
      />
      <input
        className={styles.input}
        type="number"
        step="0.1"
        name="rating"
        placeholder="Rating"
        defaultValue={tee?.rating ?? ""}
      />
      <input
        className={styles.input}
        type="number"
        name="slope"
        placeholder="Slope"
        defaultValue={tee?.slope ?? ""}
      />
      <input
        className={styles.input}
        type="number"
        name="par"
        placeholder="Par"
        defaultValue={tee?.par ?? ""}
      />
      <textarea
        className={styles.textarea}
        name="strokeIndex"
        placeholder="Stroke index, 18 comma-separated values (each of 1-18 once)"
        defaultValue={tee?.stroke_index?.join(", ") ?? ""}
      />
      <textarea
        className={styles.textarea}
        name="parByHole"
        placeholder="Par by hole, 18 comma-separated values"
        defaultValue={tee?.par_by_hole?.join(", ") ?? ""}
      />
      <textarea
        className={styles.textarea}
        name="yardageByHole"
        placeholder="Yardage by hole, 18 comma-separated values (optional)"
        defaultValue={tee?.yardage_by_hole?.join(", ") ?? ""}
      />
      <button className={styles.btn} type="submit">
        {tee ? "Save tee" : "Add tee"}
      </button>
    </form>
  );
}
