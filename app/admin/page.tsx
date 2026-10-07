import {
  addTeamMember,
  adminLogin,
  adminLogout,
  createCourse,
  createDuo,
  createScheduleItem,
  deleteChallengeBet,
  deleteCourse,
  deleteDuo,
  deleteRound,
  deleteScheduleItem,
  reassignChallengeBetWinner,
  removeTeamMember,
  resetPlayerPin,
  setRoundTee,
  setSeasonTrophies,
  setTeamCaptain,
  updateDuo,
  updatePlayerIndex,
  updateRound,
  updateScheduleItem,
  upsertCourseTee,
  voidChallengeBet,
} from "./actions";
import Link from "next/link";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { buildDeleteWarning } from "./deleteWarnings";
import styles from "./admin.module.css";
import pageStyles from "../page.module.css";
import { isAdminAuthed } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { formatArizonaTime, utcIsoToArizonaDatetimeLocal } from "@/lib/timezone";
import { deriveMatches, groupTeeTimeIso, isShortHanded, maxScoreByHole } from "@/engine/src";

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
  round_number: number | null;
  course_id: string;
  default_tee_id: string | null;
  first_tee_time: string | null;
  group_interval_minutes: number;
  tee_time_note: string | null;
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
interface DuoRow {
  id: string;
  round_id: string;
  team_id: string;
  player_1_id: string;
  player_2_id: string | null;
  match_slot: number;
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

// Brief 32: rebuilt against the v2 schema. Dead v1 sections (Corrections, Reverse mulligans, Skins,
// Duo submissions, the old Rounds & matchups) are intentionally not rendered — Corrections returns
// in Brief 33 alongside the scorecard.
async function loadAdminData() {
  const supabase = await createClient();
  const [
    players,
    teams,
    teamMembers,
    rounds,
    courses,
    courseTees,
    duos,
    holeScoreDuoIds,
    mulliganDuoIds,
    challengeBets,
    seasonsCore,
    scheduleItems,
  ] = await Promise.all([
    supabase.from("players").select("id, name, index").order("name"),
    supabase.from("teams").select("id, name, captain_player_id").order("name"),
    supabase.from("team_members").select("team_id, player_id"),
    supabase
      .from("rounds")
      .select("id, date, round_number, course_id, default_tee_id, first_tee_time, group_interval_minutes, tee_time_note")
      .order("round_number", { ascending: true, nullsFirst: false })
      .order("date"),
    supabase.from("courses").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("course_tees")
      .select("id, course_id, tee_name, rating, slope, par, stroke_index, par_by_hole, yardage_by_hole")
      .order("tee_name"),
    supabase.from("duos").select("id, round_id, team_id, player_1_id, player_2_id, match_slot").order("match_slot"),
    // Lightweight FK-only fetches so a duo with scores shows as locked rather than offering a delete.
    supabase.from("hole_scores").select("duo_id"),
    supabase.from("reverse_mulligans").select("duo_id"),
    supabase
      .from("challenge_bets")
      .select("id, proposer_id, acceptor_id, terms, stake, status, winner_player_id"),
    supabase.from("seasons").select("id, year, name, cup_winner_team_id").order("year", { ascending: false }),
    supabase
      .from("schedule_items")
      .select("id, season_id, title, starts_at, notes")
      .order("starts_at", { ascending: true, nullsFirst: false }),
  ]);

  // Orphaned v1 trophy columns (Low Man / Skins King): fetched separately so the Champions wall
  // still renders if they're ever dropped.
  const { data: trophies } = await supabase
    .from("seasons")
    .select("id, individual_champion_player_id, skins_king_player_id");
  const trophiesBySeason = new Map((trophies ?? []).map((t) => [t.id, t]));
  const seasonsList = (seasonsCore.data ?? []).map((s) => ({
    ...s,
    individual_champion_player_id: trophiesBySeason.get(s.id)?.individual_champion_player_id ?? null,
    skins_king_player_id: trophiesBySeason.get(s.id)?.skins_king_player_id ?? null,
  })) as Season[];

  function countBy(rows: { duo_id: string }[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.duo_id, (map.get(r.duo_id) ?? 0) + 1);
    return map;
  }

  const loadErrors = [
    ["players", players.error],
    ["teams", teams.error],
    ["team_members", teamMembers.error],
    ["rounds", rounds.error],
    ["courses", courses.error],
    ["course_tees", courseTees.error],
    ["duos", duos.error],
    ["hole_scores", holeScoreDuoIds.error],
    ["reverse_mulligans", mulliganDuoIds.error],
  ]
    .filter(([, e]) => e)
    .map(([name, e]) => `${name}: ${(e as { message: string }).message}`);

  return {
    loadErrors,
    players: (players.data ?? []) as Player[],
    teams: (teams.data ?? []) as Team[],
    teamMembers: (teamMembers.data ?? []) as TeamMember[],
    rounds: (rounds.data ?? []) as Round[],
    courses: (courses.data ?? []) as Course[],
    courseTees: (courseTees.data ?? []) as CourseTee[],
    duos: (duos.data ?? []) as DuoRow[],
    scoresByDuo: countBy(holeScoreDuoIds.data ?? []),
    mulligansByDuo: countBy(mulliganDuoIds.data ?? []),
    challengeBets: (challengeBets.data ?? []) as ChallengeBet[],
    seasons: seasonsList,
    scheduleItems: (scheduleItems.data ?? []) as ScheduleItem[],
  };
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
    loadErrors,
    players,
    teams,
    teamMembers,
    rounds,
    courses,
    courseTees,
    duos,
    scoresByDuo,
    mulligansByDuo,
    challengeBets,
    seasons,
    scheduleItems,
  } = await loadAdminData();

  const north = teams.find((t) => t.name === "North Hedges");
  const south = teams.find((t) => t.name === "South Hedges");
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  // Re-opens edit forms showing the Arizona time Chris originally set, not a value shifted by
  // whatever timezone this server process happens to be in (Brief 26).
  function toDatetimeLocal(value: string | null): string {
    return value ? utcIsoToArizonaDatetimeLocal(value) : "";
  }

  function courseDeleteWarning(courseId: string, name: string): string {
    return buildDeleteWarning(`"${name}"`, {
      teeSetups: courseTees.filter((t) => t.course_id === courseId).length,
    });
  }

  function roundDeleteWarning(round: Round): string {
    const roundDuos = duos.filter((d) => d.round_id === round.id);
    const scores = roundDuos.reduce((n, d) => n + (scoresByDuo.get(d.id) ?? 0), 0);
    if (roundDuos.length === 0) return `Delete ${roundLabel(round)}? This cannot be undone.`;
    return `${roundLabel(round)} has ${roundDuos.length} ${roundDuos.length === 1 ? "duo" : "duos"} and ${scores} hole ${scores === 1 ? "score" : "scores"}. A round with duos or scores can't be deleted — remove them first. Try anyway?`;
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
      {loadErrors.length > 0 && (
        <div className={styles.flashErr}>
          Some data failed to load — has migration 0026/0027 been run? {loadErrors.join(" · ")}
        </div>
      )}

      {/* ---------------- Rounds ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Rounds</div>
        {rounds.length === 0 && <div className={styles.hint}>No rounds yet — run migration 0027.</div>}
        {rounds.map((round) => {
          const tees = courseTees.filter((t) => t.course_id === round.course_id);
          const activeTee = courseTees.find((t) => t.id === round.default_tee_id) ?? null;
          return (
            <div key={round.id} className={styles.roundCard}>
              <div className={styles.roundCardHead}>
                <b style={{ color: "var(--cream)" }}>{roundLabel(round)}</b>
                <span className={styles.hint}>{courseName(courses, round.course_id)}</span>
              </div>

              <div className={styles.hint}>
                Active tee:{" "}
                <b style={{ color: "var(--gold)" }}>{activeTee ? activeTee.tee_name : "none set"}</b>
                {activeTee && ` · ${totalYards(activeTee)} yds · ${activeTee.rating}/${activeTee.slope}`}
              </div>
              {tees.length > 1 && (
                <div className={styles.inlineForm}>
                  {tees.map((t) => (
                    <form key={t.id} action={setRoundTee}>
                      <input type="hidden" name="roundId" value={round.id} />
                      <input type="hidden" name="teeId" value={t.id} />
                      <button className={t.id === round.default_tee_id ? styles.btn : styles.btnGhost} type="submit">
                        {t.tee_name}
                      </button>
                    </form>
                  ))}
                </div>
              )}
              {tees.length > 1 && (
                <div className={styles.hint}>
                  Switching tees only changes displayed yardage and course-handicap intel. Scoring is gross
                  and both tees share pars, so nothing competitive changes.
                </div>
              )}

              <div className={styles.hint}>
                Tee times (Arizona time):{" "}
                {round.first_tee_time
                  ? [1, 2, 3, 4]
                      .map(
                        (k) =>
                          `G${k} ${formatArizonaTime(groupTeeTimeIso(round.first_tee_time!, round.group_interval_minutes, k))}`,
                      )
                      .join(" · ")
                  : "not set"}
              </div>
              {round.tee_time_note && <div className={styles.badgeWarn}>{round.tee_time_note}</div>}

              <form action={updateRound} className={styles.inlineForm}>
                <input type="hidden" name="roundId" value={round.id} />
                <select className={styles.select} name="courseId" defaultValue={round.course_id}>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select className={styles.select} name="teeId" defaultValue={round.default_tee_id ?? ""}>
                  <option value="">No tee</option>
                  {courseTees.map((t) => (
                    <option key={t.id} value={t.id}>
                      {courseName(courses, t.course_id)} — {t.tee_name}
                    </option>
                  ))}
                </select>
                <label className={styles.checkboxLabel}>
                  First tee
                  <input
                    className={styles.input}
                    type="datetime-local"
                    name="firstTeeTime"
                    defaultValue={toDatetimeLocal(round.first_tee_time)}
                  />
                </label>
                <label className={styles.checkboxLabel}>
                  Interval (min)
                  <input
                    className={styles.input}
                    type="number"
                    name="groupIntervalMinutes"
                    min={1}
                    max={60}
                    defaultValue={round.group_interval_minutes}
                    style={{ width: 70 }}
                  />
                </label>
                <input
                  className={styles.input}
                  name="teeTimeNote"
                  placeholder="Note (blank = confirmed)"
                  defaultValue={round.tee_time_note ?? ""}
                />
                <button className={styles.btn} type="submit">
                  Save round
                </button>
              </form>
              <form action={deleteRound}>
                <input type="hidden" name="roundId" value={round.id} />
                <ConfirmDeleteButton className={styles.btnDanger} confirmMessage={roundDeleteWarning(round)}>
                  Delete round
                </ConfirmDeleteButton>
              </form>
            </div>
          );
        })}
      </section>

      {/* ---------------- Teams ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Teams</div>
        <div className={styles.hint}>
          North Hedges and South Hedges are fixed. Set each year&apos;s captain and roster here.
        </div>
        {teams.length === 0 && <div className={styles.hint}>No teams yet — run migration 0027.</div>}
        {teams.map((team) => {
          const members = teamMembers.filter((m) => m.team_id === team.id);
          const memberIds = new Set(members.map((m) => m.player_id));
          const available = players.filter((p) => !memberIds.has(p.id));
          return (
            <div key={team.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div className={styles.title} style={{ fontSize: 18 }}>
                {team.name}
              </div>
              <form action={setTeamCaptain} className={styles.inlineForm}>
                <input type="hidden" name="teamId" value={team.id} />
                <select className={styles.select} name="captainPlayerId" defaultValue={team.captain_player_id ?? ""}>
                  <option value="">No captain</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button className={styles.btn} type="submit">
                  Set captain
                </button>
              </form>
              <div className={styles.hint}>
                {members.length === 0 ? "No members yet" : `${members.length} on roster`}
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
      </section>

      {/* ---------------- Duos per round (stopgap pairing form) ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Duos &amp; matches</div>
        <div className={styles.hint}>
          Stopgap until the Pairings Night board exists, then the commissioner&apos;s override. A match is a
          North duo and a South duo sharing a slot. Slots aren&apos;t forced to 4 — a short-handed side just
          runs fewer.
        </div>
        {(!north || !south) && <div className={styles.hint}>Both teams must exist first.</div>}
        {north &&
          south &&
          rounds.map((round) => {
            const roundDuos = duos.filter((d) => d.round_id === round.id);
            const inDuo = new Set(roundDuos.flatMap((d) => [d.player_1_id, d.player_2_id]));
            const matches = deriveMatches(
              roundDuos.map((d) => ({ ...d, teamId: d.team_id, matchSlot: d.match_slot })),
              north.id,
              south.id,
            );
            const duoLabel = (d: DuoRow | null) =>
              d
                ? `${playerName(d.player_1_id)}${d.player_2_id ? ` + ${playerName(d.player_2_id)}` : ""}`
                : "—";
            return (
              <div key={round.id} className={styles.roundCard}>
                <div className={styles.roundCardHead}>
                  <b style={{ color: "var(--cream)" }}>{roundLabel(round)}</b>
                  <span className={styles.hint}>{matches.length} of 4 slots</span>
                </div>

                {matches.length === 0 && <div className={styles.hint}>No duos yet.</div>}
                {matches.map((m) => (
                  <div key={m.matchSlot} className={styles.hint}>
                    <b style={{ color: "var(--cream)" }}>Slot {m.matchSlot}</b>
                    {round.first_tee_time &&
                      ` · ${formatArizonaTime(groupTeeTimeIso(round.first_tee_time, round.group_interval_minutes, m.matchSlot))}`}
                    {" · "}
                    {duoLabel(m.north as DuoRow | null)} <b>vs</b> {duoLabel(m.south as DuoRow | null)}
                    {m.north && isShortHanded({ player2Id: (m.north as DuoRow).player_2_id }) && " ⚠ North short-handed"}
                    {m.south && isShortHanded({ player2Id: (m.south as DuoRow).player_2_id }) && " ⚠ South short-handed"}
                  </div>
                ))}

                {[north, south].map((team) => {
                  const roster = teamMembers.filter((m) => m.team_id === team.id).map((m) => m.player_id);
                  const teamDuos = roundDuos.filter((d) => d.team_id === team.id);
                  const free = roster.filter((id) => !inDuo.has(id));
                  return (
                    <div key={team.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className={styles.matchupsLabel}>{team.name}</div>
                      {teamDuos.map((d) => {
                        const scores = scoresByDuo.get(d.id) ?? 0;
                        const mulligans = mulligansByDuo.get(d.id) ?? 0;
                        const locked = scores > 0 || mulligans > 0;
                        const options = roster.filter(
                          (id) => id === d.player_1_id || id === d.player_2_id || !inDuo.has(id),
                        );
                        return (
                          <div key={d.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
                            {d.player_2_id === null && <span className={styles.badgeWarn}>Short-handed</span>}
                            <form action={updateDuo} className={styles.inlineForm}>
                              <input type="hidden" name="id" value={d.id} />
                              <input type="hidden" name="roundId" value={round.id} />
                              <input type="hidden" name="teamId" value={team.id} />
                              <select className={styles.select} name="player1Id" defaultValue={d.player_1_id}>
                                {options.map((id) => (
                                  <option key={id} value={id}>
                                    {playerName(id)}
                                  </option>
                                ))}
                              </select>
                              <select className={styles.select} name="player2Id" defaultValue={d.player_2_id ?? ""}>
                                <option value="">— short-handed —</option>
                                {options.map((id) => (
                                  <option key={id} value={id}>
                                    {playerName(id)}
                                  </option>
                                ))}
                              </select>
                              <select className={styles.select} name="matchSlot" defaultValue={d.match_slot}>
                                {[1, 2, 3, 4].map((n) => (
                                  <option key={n} value={n}>
                                    Slot {n}
                                  </option>
                                ))}
                              </select>
                              <button className={styles.btn} type="submit">
                                Save
                              </button>
                            </form>
                            {locked ? (
                              <div className={styles.hint}>
                                Has {scores} hole {scores === 1 ? "score" : "scores"}
                                {mulligans > 0 && ` and ${mulligans} reverse mulligan`} — locked. Remove them in
                                Corrections first.
                              </div>
                            ) : (
                              <form action={deleteDuo}>
                                <input type="hidden" name="id" value={d.id} />
                                <ConfirmDeleteButton
                                  className={styles.btnDanger}
                                  confirmMessage={`Delete ${duoLabel(d)}? This cannot be undone.`}
                                >
                                  Delete duo
                                </ConfirmDeleteButton>
                              </form>
                            )}
                          </div>
                        );
                      })}
                      {free.length > 0 ? (
                        <form action={createDuo} className={styles.inlineForm}>
                          <input type="hidden" name="roundId" value={round.id} />
                          <input type="hidden" name="teamId" value={team.id} />
                          <select className={styles.select} name="player1Id" defaultValue="">
                            <option value="" disabled>
                              Player 1…
                            </option>
                            {free.map((id) => (
                              <option key={id} value={id}>
                                {playerName(id)}
                              </option>
                            ))}
                          </select>
                          <select className={styles.select} name="player2Id" defaultValue="">
                            <option value="">Player 2 (blank = short-handed)</option>
                            {free.map((id) => (
                              <option key={id} value={id}>
                                {playerName(id)}
                              </option>
                            ))}
                          </select>
                          <select className={styles.select} name="matchSlot" defaultValue="1">
                            {[1, 2, 3, 4].map((n) => (
                              <option key={n} value={n}>
                                Slot {n}
                              </option>
                            ))}
                          </select>
                          <button className={styles.btn} type="submit">
                            Add {team.name.split(" ")[0]} duo
                          </button>
                        </form>
                      ) : (
                        <div className={styles.hint}>
                          {roster.length === 0 ? "Add players to this team first." : "Everyone on this team is already in a duo."}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
      </section>

      {/* ---------------- Courses & tees ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Courses &amp; tees</div>
        <div className={styles.countNote}>
          ⚠ Pars drive the mercy cap (par + 2), so a wrong par silently changes match results. Rating, slope,
          yardage and stroke index are display-only.
        </div>
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
                <details key={tee.id} className={styles.teeDetails}>
                  <summary>
                    <b>{tee.tee_name}</b> · par {tee.par} · {totalYards(tee)} yds · {tee.rating}/{tee.slope}
                  </summary>
                  <TeeHoleTable tee={tee} />
                  <CourseTeeForm courseId={course.id} tee={tee} />
                </details>
              ))}
            <details className={styles.teeDetails}>
              <summary>+ Add a tee</summary>
              <CourseTeeForm courseId={course.id} tee={null} />
            </details>
          </div>
        ))}
        <form action={createCourse} className={styles.inlineForm}>
          <input className={styles.input} name="name" placeholder="New course name" />
          <button className={styles.btn} type="submit">
            Create course
          </button>
        </form>
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

function totalYards(tee: CourseTee): string {
  return tee.yardage_by_hole ? tee.yardage_by_hole.reduce((s, n) => s + n, 0).toLocaleString("en-US") : "—";
}

/** "Round 1 — Sat, Mar 27". The date column is a plain calendar date, so format it in UTC. */
function roundLabel(round: Round): string {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${round.date}T12:00:00Z`));
  return `${round.round_number ? `Round ${round.round_number}` : "Round"} — ${date}`;
}

/** Per-hole readout (par / yards / stroke index / Max) so Chris can spot-check a tee against the card. */
function TeeHoleTable({ tee }: { tee: CourseTee }) {
  if (!tee.par_by_hole) return <div className={styles.hint}>No per-hole pars on file for this tee.</div>;
  const max = maxScoreByHole(tee.par_by_hole);
  const holes = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div style={{ overflowX: "auto" }}>
      <table className={styles.holeTable}>
        <thead>
          <tr>
            <th>Hole</th>
            <th>Par</th>
            <th>Yds</th>
            <th>SI</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{tee.par_by_hole![i]}</td>
              <td>{tee.yardage_by_hole?.[i] ?? "—"}</td>
              <td>{tee.stroke_index[i]}</td>
              <td>{max[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
