import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSeason, getQaSeason } from "@/lib/season";
import {
  buildMatchHoles,
  computeMatchState,
  formatPoints,
  segmentLabel,
} from "@/engine/src";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { deleteDuo } from "./actions";
import {
  correctBestBallScores,
  correctScrambleScore,
  deleteHoleScores,
  deleteMatchScores,
  removeReverseMulliganCall,
} from "./corrActions";
import styles from "./admin.module.css";

// Brief 33 Part E: Corrections, rebuilt for duo scores. Scoped to the selected season (2027 or QA),
// drill-down round -> match -> hole. All edits flow through the same engine, so match state
// recomputes everywhere (store raw, derive everything).
export async function Corrections({ params }: { params: Record<string, string | undefined> }) {
  const admin = createAdminClient();
  const scope = params.cscope === "qa" ? "qa" : "real";
  const season = scope === "qa" ? await getQaSeason(admin) : await getCurrentSeason(admin);

  const link = (over: Record<string, string>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      cscope: scope === "qa" ? "qa" : undefined,
      cround: params.cround,
      cslot: params.cslot,
      chole: params.chole,
      ...over,
    };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    return `/admin?${q.toString()}#corrections`;
  };

  const header = (
    <>
      <div className={styles.sectionTitle}>Corrections</div>
      <div className={styles.inlineForm}>
        <a href={link({ cscope: "", cround: "", cslot: "", chole: "" })} className={scope === "real" ? styles.btn : styles.btnGhost}>
          2027 season
        </a>
        <a href={link({ cscope: "qa", cround: "", cslot: "", chole: "" })} className={scope === "qa" ? styles.btn : styles.btnGhost}>
          QA sandbox
        </a>
      </div>
    </>
  );

  if (!season) {
    return (
      <section className={styles.section} id="corrections">
        {header}
        <div className={styles.hint}>No season found for this scope.</div>
      </section>
    );
  }

  const { data: rounds } = await admin
    .from("rounds")
    .select("id, round_number, format, default_tee_id")
    .eq("season_id", season.id)
    .order("round_number");
  const round = (rounds ?? []).find((r) => r.id === params.cround) ?? rounds?.[0];

  if (!round) {
    return (
      <section className={styles.section} id="corrections">
        {header}
        <div className={styles.hint}>No rounds in this season yet.</div>
      </section>
    );
  }

  const { data: duos } = await admin
    .from("duos")
    .select("id, team_id, match_slot, player_1_id, player_2_id")
    .eq("round_id", round.id)
    .order("match_slot");
  const { data: teams } = await admin.from("teams").select("id, name").eq("season_id", season.id);
  const slots = [...new Set((duos ?? []).map((d) => d.match_slot))].sort((a, b) => a - b);
  const slot = slots.includes(Number(params.cslot)) ? Number(params.cslot) : slots[0];
  const hole = Math.min(18, Math.max(1, Number(params.chole) || 1));

  const roundNav = (
    <div className={styles.inlineForm}>
      {(rounds ?? []).map((r) => (
        <a key={r.id} href={link({ cround: r.id, cslot: "", chole: "" })} className={r.id === round.id ? styles.btn : styles.btnGhost}>
          Round {r.round_number ?? "?"} · {r.format === "best_ball" ? "best ball" : "scramble"}
        </a>
      ))}
    </div>
  );

  if (slot === undefined) {
    return (
      <section className={styles.section} id="corrections">
        {header}
        {roundNav}
        <div className={styles.hint}>No duos in this round yet.</div>
      </section>
    );
  }

  const matchDuos = (duos ?? []).filter((d) => d.match_slot === slot);
  const teamName = (id: string) => teams?.find((t) => t.id === id)?.name ?? "?";
  const north = matchDuos.find((d) => teamName(d.team_id) === "North Hedges");
  const south = matchDuos.find((d) => teamName(d.team_id) === "South Hedges");
  const duoIds = matchDuos.map((d) => d.id);

  const playerIds = matchDuos.flatMap((d) => [d.player_1_id, d.player_2_id]).filter((x): x is string => !!x);
  const { data: players } = await admin.from("players").select("id, name").in("id", playerIds);
  const nameOf = (id: string | null) => (id ? players?.find((p) => p.id === id)?.name ?? "?" : "the commissioner");

  const [{ data: sRows }, { data: bRows }, { data: rmRows }, { data: tee }] = await Promise.all([
    admin.from("hole_scores").select("duo_id, hole, strokes, tee_shot_used_player_id, updated_by_player_id").eq("round_id", round.id).in("duo_id", duoIds),
    admin.from("player_hole_scores").select("duo_id, player_id, hole, strokes, updated_by_player_id").eq("round_id", round.id).in("duo_id", duoIds),
    admin.from("reverse_mulligans").select("id, duo_id, hole").eq("round_id", round.id).in("duo_id", duoIds),
    round.default_tee_id
      ? admin.from("course_tees").select("par_by_hole").eq("id", round.default_tee_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const returnTo = link({ cround: round.id, cslot: String(slot), chole: String(hole) });
  const isScramble = round.format === "scramble";
  const par = tee?.par_by_hole?.[hole - 1] ?? null;

  const state =
    north && south && tee?.par_by_hole
      ? computeMatchState(
          buildMatchHoles({
            format: round.format,
            parByHole: tee.par_by_hole,
            duoAId: north.id,
            duoBId: south.id,
            scrambleRows: (sRows ?? []).map((r) => ({ duoId: r.duo_id, hole: r.hole, strokes: r.strokes })),
            bestBallRows: (bRows ?? []).map((r) => ({ duoId: r.duo_id, playerId: r.player_id, hole: r.hole, strokes: r.strokes })),
          }),
        )
      : null;

  const duoLabel = (d: (typeof matchDuos)[number]) =>
    `${teamName(d.team_id).split(" ")[0]}: ${nameOf(d.player_1_id)}${d.player_2_id ? ` + ${nameOf(d.player_2_id)}` : ""}`;

  return (
    <section className={styles.section} id="corrections">
      {header}
      <div className={styles.hint}>
        Edit a duo&apos;s score for one hole. Everything recomputes from the raw numbers. Deleting a duo needs its
        scores (and mulligan call) removed here first.
      </div>
      {roundNav}
      <div className={styles.inlineForm}>
        {slots.map((s) => (
          <a key={s} href={link({ cround: round.id, cslot: String(s), chole: String(hole) })} className={s === slot ? styles.btn : styles.btnGhost}>
            Slot {s}
          </a>
        ))}
      </div>

      {state && (
        <div className={styles.hint}>
          Match status: F9 {segmentLabel(state.front9).text} · B9 {segmentLabel(state.back9).text} · 18 {segmentLabel(state.overall18).text} · points North{" "}
          {formatPoints(state.totalPoints.a)} – South {formatPoints(state.totalPoints.b)}
        </div>
      )}

      <div className={styles.holeNav}>
        <a href={link({ cround: round.id, cslot: String(slot), chole: String(Math.max(1, hole - 1)) })} className={hole <= 1 ? styles.navbtnDisabled : styles.navbtn}>
          ‹
        </a>
        <div className={styles.holeBignum}>
          Hole {hole}
          {par ? ` · par ${par}` : ""}
        </div>
        <a href={link({ cround: round.id, cslot: String(slot), chole: String(Math.min(18, hole + 1)) })} className={hole >= 18 ? styles.navbtnDisabled : styles.navbtn}>
          ›
        </a>
      </div>

      {matchDuos.map((d) => {
        const sRow = (sRows ?? []).find((r) => r.duo_id === d.id && r.hole === hole);
        const players = [d.player_1_id, d.player_2_id].filter((x): x is string => !!x);
        const updatedBy = isScramble
          ? sRow
            ? nameOf(sRow.updated_by_player_id)
            : null
          : (() => {
              const rows = (bRows ?? []).filter((r) => r.duo_id === d.id && r.hole === hole);
              return rows.length ? nameOf(rows[0].updated_by_player_id) : null;
            })();
        return (
          <div key={d.id} className={styles.row} style={{ flexDirection: "column", alignItems: "stretch" }}>
            <div className={styles.hint}>
              <b style={{ color: "var(--cream)" }}>{duoLabel(d)}</b>
              {updatedBy && ` · updated by ${updatedBy}`}
            </div>
            {isScramble ? (
              <form action={correctScrambleScore} className={styles.inlineForm}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="duoId" value={d.id} />
                <input type="hidden" name="roundId" value={round.id} />
                <input type="hidden" name="hole" value={hole} />
                <input className={styles.input} type="number" name="strokes" min={1} max={20} defaultValue={sRow?.strokes ?? ""} placeholder="Strokes" style={{ width: 90 }} />
                <select className={styles.select} name="teeShotPlayerId" defaultValue={sRow?.tee_shot_used_player_id ?? ""}>
                  <option value="">Drive: none</option>
                  {players.map((pid) => (
                    <option key={pid} value={pid}>
                      Drive: {nameOf(pid)}
                    </option>
                  ))}
                </select>
                <button className={styles.btn} type="submit">
                  Save
                </button>
              </form>
            ) : (
              <form action={correctBestBallScores} className={styles.inlineForm}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <input type="hidden" name="duoId" value={d.id} />
                <input type="hidden" name="roundId" value={round.id} />
                <input type="hidden" name="hole" value={hole} />
                <input type="hidden" name="playerIds" value={players.join(",")} />
                {players.map((pid) => {
                  const row = (bRows ?? []).find((r) => r.duo_id === d.id && r.player_id === pid && r.hole === hole);
                  return (
                    <label key={pid} className={styles.checkboxLabel}>
                      {nameOf(pid)}
                      <input className={styles.input} type="number" name={`strokes_${pid}`} min={1} max={20} defaultValue={row?.strokes ?? ""} placeholder="blank = picked up" style={{ width: 90 }} />
                    </label>
                  );
                })}
                <button className={styles.btn} type="submit">
                  Save
                </button>
              </form>
            )}
          </div>
        );
      })}

      <div className={styles.inlineForm}>
        <form action={deleteHoleScores}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="duoIds" value={duoIds.join(",")} />
          <input type="hidden" name="hole" value={hole} />
          <ConfirmDeleteButton className={styles.btnDanger} confirmMessage={`Delete both duos' scores for hole ${hole}? This cannot be undone.`}>
            Delete hole {hole} scores
          </ConfirmDeleteButton>
        </form>
        <form action={deleteMatchScores}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <input type="hidden" name="duoIds" value={duoIds.join(",")} />
          <ConfirmDeleteButton className={styles.btnDanger} confirmMessage="Delete EVERY score for this match (all holes, both duos)? This cannot be undone.">
            Delete all scores for this match
          </ConfirmDeleteButton>
        </form>
      </div>

      <div className={styles.matchupsLabel}>Delete a duo</div>
      <div className={styles.hint}>
        A duo with scores or a mulligan call can&apos;t be deleted — the database refuses. Remove them above first.
      </div>
      <div className={styles.inlineForm}>
        {matchDuos.map((d) => (
          <form key={d.id} action={deleteDuo}>
            <input type="hidden" name="id" value={d.id} />
            <ConfirmDeleteButton className={styles.btnDanger} confirmMessage={`Delete ${duoLabel(d)}?`}>
              Delete {teamName(d.team_id).split(" ")[0]} duo
            </ConfirmDeleteButton>
          </form>
        ))}
      </div>

      <div className={styles.matchupsLabel}>Reverse mulligan calls</div>
      {(rmRows ?? []).length === 0 && <div className={styles.hint}>None called in this match.</div>}
      {(rmRows ?? []).map((rm) => {
        const duo = matchDuos.find((d) => d.id === rm.duo_id);
        return (
          <div key={rm.id} className={styles.row}>
            <span>
              {duo ? duoLabel(duo) : "?"} · hole {rm.hole}
            </span>
            <form action={removeReverseMulliganCall}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="id" value={rm.id} />
              <ConfirmDeleteButton
                className={styles.btnDanger}
                confirmMessage="Remove this reverse mulligan call? That duo gets its one back for the round. This cannot be undone."
              >
                Remove call
              </ConfirmDeleteButton>
            </form>
          </div>
        );
      })}
    </section>
  );
}
