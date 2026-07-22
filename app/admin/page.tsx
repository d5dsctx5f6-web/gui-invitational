import {
  addTeamMember,
  adminLogin,
  adminLogout,
  correctHoleScore,
  createCourse,
  createRound,
  createTeam,
  deleteMatch,
  removeTeamMember,
  updatePlayerIndex,
  updateTeam,
  upsertCourseTee,
  upsertMatch,
} from "./actions";
import styles from "./admin.module.css";
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

async function loadAdminData() {
  const supabase = await createClient();
  const [players, teams, teamMembers, rounds, matches, courses, courseTees] =
    await Promise.all([
      supabase.from("players").select("id, name, index").order("name"),
      supabase.from("teams").select("id, name, captain_player_id").order("name"),
      supabase.from("team_members").select("team_id, player_id"),
      supabase.from("rounds").select("id, date, format, course_id, default_tee_id").order("date"),
      supabase.from("matches").select("id, round_id, team_a_id, team_b_id, slot"),
      supabase.from("courses").select("id, name").order("name"),
      supabase
        .from("course_tees")
        .select("id, course_id, tee_name, rating, slope, par, stroke_index, par_by_hole, yardage_by_hole"),
    ]);

  return {
    players: (players.data ?? []) as Player[],
    teams: (teams.data ?? []) as Team[],
    teamMembers: (teamMembers.data ?? []) as TeamMember[],
    rounds: (rounds.data ?? []) as Round[],
    matches: (matches.data ?? []) as Match[],
    courses: (courses.data ?? []) as Course[],
    courseTees: (courseTees.data ?? []) as CourseTee[],
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

  const { players, teams, teamMembers, rounds, matches, courses, courseTees } =
    await loadAdminData();
  const selectedRoundId = params.round ?? rounds[0]?.id;
  const holeScores = await loadHoleScores(selectedRoundId);

  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div className={styles.title}>Commissioner</div>
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
              <div className={styles.hint}>
                <b style={{ color: "var(--cream)" }}>{round.date}</b> · {round.format}
              </div>
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
                    <button className={styles.btnDanger} type="submit">
                      Remove
                    </button>
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

      {/* ---------------- Indexes ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Handicap indexes</div>
        {players.map((p) => (
          <form key={p.id} action={updatePlayerIndex} className={styles.row}>
            <input type="hidden" name="playerId" value={p.id} />
            <span>{p.name}</span>
            <span className={styles.inlineForm}>
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
            </span>
          </form>
        ))}
      </section>

      {/* ---------------- Course setups ---------------- */}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>Course setups</div>
        {courses.map((course) => (
          <div key={course.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className={styles.hint}>
              <b style={{ color: "var(--cream)" }}>{course.name}</b>
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
        <RoundPicker rounds={rounds} selected={selectedRoundId} />
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
    </main>
  );
}

function courseName(courses: Course[], courseId: string) {
  return courses.find((c) => c.id === courseId)?.name ?? "?";
}

function RoundPicker({ rounds, selected }: { rounds: Round[]; selected: string | undefined }) {
  return (
    <div className={styles.inlineForm}>
      {rounds.map((r) => (
        <a
          key={r.id}
          href={`/admin?round=${r.id}`}
          className={r.id === selected ? styles.btn : styles.btnGhost}
        >
          {r.date}
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
