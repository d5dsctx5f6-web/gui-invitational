import { createAdminClient } from "@/lib/supabase/admin";
import { getQaSeason } from "@/lib/season";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { setRoundFormat } from "./actions";
import { autofillFromFixture, openAsQaPlayer, seedQaSandbox } from "./qaActions";
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

  const { data: round } = await admin
    .from("rounds")
    .select("id, format")
    .eq("season_id", season.id)
    .order("round_number")
    .limit(1)
    .maybeSingle();
  const { data: players } = await admin.from("players").select("id, name").eq("is_test", true).order("name");

  let posted = 0;
  let mulligans = 0;
  if (round) {
    const [a, b, c] = await Promise.all([
      admin.from("hole_scores").select("id", { count: "exact", head: true }).eq("round_id", round.id),
      admin.from("player_hole_scores").select("id", { count: "exact", head: true }).eq("round_id", round.id),
      admin.from("reverse_mulligans").select("id", { count: "exact", head: true }).eq("round_id", round.id),
    ]);
    posted = (a.count ?? 0) + (b.count ?? 0);
    mulligans = c.count ?? 0;
  }

  return (
    <section className={styles.section} id="qa">
      <div className={styles.sectionTitle}>QA sandbox</div>
      <div className={styles.hint}>
        A self-contained test world (season {season.year}) that never touches the 2027 trip. Seed it, open two
        devices as two QA players, and play a match.
      </div>
      <div className={styles.hint}>
        {round
          ? `QA round: ${round.format === "best_ball" ? "best ball" : "scramble"} · ${posted} score row${posted === 1 ? "" : "s"} · ${mulligans} mulligan call${mulligans === 1 ? "" : "s"}`
          : "No QA round yet — tap Seed / reset."}
      </div>

      <div className={styles.roundCard}>
        <div className={styles.matchupsLabel}>Seed / reset</div>
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

      {round && (
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
        <div className={styles.matchupsLabel}>Open as a QA player (this device)</div>
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
          <button className={styles.btn} type="submit" disabled={!round}>
            Autofill from fixture
          </button>
        </form>
      </div>
    </section>
  );
}
