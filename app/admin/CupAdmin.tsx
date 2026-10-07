import { createAdminClient } from "@/lib/supabase/admin";
import { cupHeadline, cupStandings, formatPoints } from "@/engine/src";
import { cupInputFrom, loadCupData } from "@/lib/cupData";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { clearChipOffWinner, recordChipOffWinner, setEventShortened } from "./cupActions";
import styles from "./admin.module.css";

/** Admin -> The Cup: the live standing plus the commissioner's two calls (chip-off, shortened). */
export async function CupAdmin() {
  const admin = createAdminClient();
  const scopes = (["real", "qa"] as const).map(async (scope) => ({ scope, data: await loadCupData(admin, scope) }));
  const loaded = await Promise.all(scopes);

  return (
    <section className={styles.section} id="cup">
      <div className={styles.sectionTitle}>The Cup</div>
      {loaded.map(({ scope, data }) => {
        if (!data.season) return null;
        const standings = cupStandings(cupInputFrom(data));
        const headline = cupHeadline(standings);
        const seasonId = data.season.id;
        return (
          <div key={scope} className={styles.roundCard}>
            <div className={styles.roundCardHead}>
              <b style={{ color: "var(--cream)" }}>{scope === "qa" ? "QA sandbox" : data.season.name}</b>
              <span className={styles.hint}>
                North {formatPoints(standings.official.a)} – South {formatPoints(standings.official.b)}
                {headline.toWin ? ` · ${headline.toWin}` : ""}
              </span>
            </div>
            {headline.line && <div className={styles.hint}>{headline.line}</div>}

            {standings.chipOffRequired && (
              <>
                <div className={styles.countNote}>Chip-off required: points and holes won are level. Record the winner once the captains have chipped.</div>
                {(["A", "B"] as const).map((side) => (
                  <form key={side} action={recordChipOffWinner}>
                    <input type="hidden" name="seasonId" value={seasonId} />
                    <input type="hidden" name="side" value={side} />
                    <ConfirmDeleteButton
                      className={styles.btn}
                      confirmMessage={`Record ${side === "A" ? "North" : "South"} Hedges as the chip-off winner? This decides the Cup.`}
                    >
                      Record {side === "A" ? "North" : "South"} Hedges as chip-off winner
                    </ConfirmDeleteButton>
                  </form>
                ))}
              </>
            )}

            {standings.banner === "chip_off_recorded" && (
              <form action={clearChipOffWinner}>
                <input type="hidden" name="seasonId" value={seasonId} />
                <ConfirmDeleteButton className={styles.btnDanger} confirmMessage="Clear the recorded chip-off winner? The Cup goes back to 'chip-off required'.">
                  Clear recorded chip-off winner
                </ConfirmDeleteButton>
              </form>
            )}

            <div className={styles.inlineForm}>
              <form action={setEventShortened}>
                <input type="hidden" name="seasonId" value={seasonId} />
                <input type="hidden" name="value" value={data.season.eventShortened ? "false" : "true"} />
                <ConfirmDeleteButton
                  className={data.season.eventShortened ? styles.btnGhost : styles.btnDanger}
                  confirmMessage={
                    data.season.eventShortened
                      ? "Undo the shortened-event declaration? All rounds count again."
                      : "Declare the event shortened? The Cup will be decided on the standings after the last fully completed round, and later rounds stop counting."
                  }
                >
                  {data.season.eventShortened ? "Undo “event shortened”" : "Declare event shortened"}
                </ConfirmDeleteButton>
              </form>
            </div>
            {data.season.eventShortened && <div className={styles.hint}>Declared shortened — only completed rounds count.</div>}
          </div>
        );
      })}
    </section>
  );
}
