import { createAdminClient } from "@/lib/supabase/admin";
import { getQaSeason } from "@/lib/season";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { setRoundFormat } from "./actions";
import { autofillFromFixture, loadScenarioAction, openAsQaPlayer, seedFullTripAction, seedQaSandbox } from "./qaActions";
import { QA_SCENARIOS } from "@/engine/src";
import styles from "./admin.module.css";

// Brief 33 Part C: Admin -> QA sandbox. Reads with the service role so it shows the QA world
// regardless of this device's own sign-in state.
export async function QaSandbox() {
  const admin = createAdminClient();
  const season = await getQaSeason(admin);

  if (!season) {
    return (
      <section className={styles.section} id="qa">
        <div className={styles.sectionTitle}>QA sandbox</div>
        <div className={styles.hint}>The QA season doesn&apos;t exist yet — run migration 0031.</div>
      </section>
    );
  }

  const { data: rounds } = await admin
    .from("rounds")
    .select("id, format, round_number")
    .eq("season_id", season.id)
    .order("round_number");
  const round = rounds?.[0] ?? null;
  const { data: players } = await admin.from("players").select("id, name").eq("is_test", true).order("name");

  let posted = 0;
  let mulligans = 0;
  let qaDuos = 0;
  if (rounds && rounds.length > 0) {
    const ids = rounds.map((r) => r.id);
    const [a, b, c, d] = await Promise.all([
      admin.from("hole_scores").select("id", { count: "exact", head: true }).in("round_id", ids),
      admin.from("player_hole_scores").select("id", { count: "exact", head: true }).in("round_id", ids),
      admin.from("reverse_mulligans").select("id", { count: "exact", head: true }).in("round_id", ids),
      admin.from("duos").select("id", { count: "exact", head: true }).in("round_id", ids),
    ]);
    posted = (a.count ?? 0) + (b.count ?? 0);
    mulligans = c.count ?? 0;
    qaDuos = d.count ?? 0;
  }
  const singleMatch = qaDuos === 2;

  return (
    <section className={styles.section} id="qa">
      <div className={styles.sectionTitle}>QA sandbox</div>
      <div className={styles.hint}>
        A self-contained test world (season {season.year}) that never touches the 2027 trip. Seed it, open two
        devices as two QA players, and play a match.
      </div>
      <div className={styles.hint}>
        {round
          ? `${rounds!.length} QA round${rounds!.length === 1 ? "" : "s"} (${rounds!.map((r) => (r.format === "best_ball" ? "best ball" : "scramble")).join(", ")}) · ${qaDuos} duos · ${posted} score row${posted === 1 ? "" : "s"} · ${mulligans} mulligan call${mulligans === 1 ? "" : "s"}`
          : "No QA round yet — seed a single match or the full trip."}
      </div>

      <div className={styles.roundCard}>
        <div className={styles.matchupsLabel}>Seed / reset — single match</div>
        <div className={styles.hint}>Wipes the QA scores, mulligans, duos and round, then re-seeds QA North 1 + 2 vs QA South 1 + 2.</div>
        <div className={styles.inlineForm}>
          {(["scramble", "best_ball"] as const).map((format) => (
            <form key={format} action={seedQaSandbox}>
              <input type="hidden" name="format" value={format} />
              <ConfirmDeleteButton
                className={styles.btn}
                confirmMessage={`Reset the QA sandbox and seed a ${format === "best_ball" ? "best ball" : "scramble"} match? This only touches QA data.`}
              >
                Seed / reset ({format === "best_ball" ? "best ball" : "scramble"})
              </ConfirmDeleteButton>
            </form>
          ))}
        </div>
      </div>

      {round && singleMatch && (
        <div className={styles.roundCard}>
          <div className={styles.matchupsLabel}>Round format (QA round)</div>
          <div className={styles.hint}>
            Currently {round.format === "best_ball" ? "best ball" : "scramble"}. The format locks once any score exists — try
            switching it after posting a hole to see the lock.
          </div>
          <div className={styles.inlineForm}>
            {(["scramble", "best_ball"] as const).map((f) => (
              <form key={f} action={setRoundFormat}>
                <input type="hidden" name="roundId" value={round.id} />
                <input type="hidden" name="format" value={f} />
                <button className={f === round.format ? styles.btn : styles.btnGhost} type="submit">
                  {f === "best_ball" ? "Best ball" : "Scramble"}
                </button>
              </form>
            ))}
          </div>
          {posted > 0 && <div className={styles.hint}>Format is locked — scores have been posted for this round.</div>}
        </div>
      )}

      <div className={styles.roundCard}>
        <div className={styles.matchupsLabel}>Full trip — 16 players, two rounds, four matches each</div>
        <div className={styles.hint}>
          Round 1 is scramble on O&apos;odham Gold; pick Round 2&apos;s format (Saguaro Purple). Seeds with no scores.
        </div>
        <div className={styles.inlineForm}>
          {(["scramble", "best_ball"] as const).map((f) => (
            <form key={f} action={seedFullTripAction}>
              <input type="hidden" name="round2Format" value={f} />
              <ConfirmDeleteButton className={styles.btn} confirmMessage="Reset the QA sandbox and seed the full trip? This only touches QA data.">
                Seed full trip (Round 2 {f === "best_ball" ? "best ball" : "scramble"})
              </ConfirmDeleteButton>
            </form>
          ))}
        </div>
        <div className={styles.matchupsLabel}>Load a scenario (resets QA, then writes its scores)</div>
        {QA_SCENARIOS.map((sc) => (
          <form key={sc.id} action={loadScenarioAction} className={styles.inlineForm}>
            <input type="hidden" name="scenario" value={sc.id} />
            <select className={styles.select} name="round2Format" defaultValue="scramble" aria-label={`Round 2 format for scenario ${sc.id}`}>
              <option value="scramble">R2 scramble</option>
              <option value="best_ball">R2 best ball</option>
            </select>
            <ConfirmDeleteButton className={styles.btn} confirmMessage={`Load scenario ${sc.id}? This resets the QA sandbox (QA data only).`}>
              Load {sc.id}
            </ConfirmDeleteButton>
            <span className={styles.hint}>{sc.name}</span>
          </form>
        ))}
        <div className={styles.inlineForm}>
          <a className={styles.btnGhost} href="/leaderboard?scope=qa">View QA leaderboard</a>
          <a className={styles.btnGhost} href="/board?scope=qa">View QA TV board</a>
        </div>
      </div>

      <div className={styles.roundCard}>
        <div className={styles.matchupsLabel}>Open as any QA player (this device)</div>
        <div className={styles.hint}>
          Switches THIS device to that QA player, then opens /score. Use Exit QA on /score to leave, then enter your own PIN.
        </div>
        <div className={styles.inlineForm}>
          {(players ?? []).map((p) => (
            <form key={p.id} action={openAsQaPlayer}>
              <input type="hidden" name="playerId" value={p.id} />
              <button className={styles.btnGhost} type="submit">
                Open as {p.name}
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className={styles.roundCard}>
        <div className={styles.matchupsLabel}>Autofill from fixture</div>
        <div className={styles.hint}>
          Posts the remaining unposted holes (and the fixture&apos;s reverse mulligan) from the pinned fixture for this round&apos;s format.
        </div>
        <form action={autofillFromFixture}>
          <button className={styles.btn} type="submit" disabled={!round || !singleMatch}>
            Autofill from fixture
          </button>
        </form>
      </div>
    </section>
  );
}
