import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import pageStyles from "../page.module.css";
import styles from "./champions.module.css";

export const dynamic = "force-dynamic";

interface Season {
  id: string;
  year: number;
  name: string;
  cup_winner_team_id: string | null;
  individual_champion_player_id: string | null;
  skins_king_player_id: string | null;
}

function romanish(year: number): string {
  // Small franchise flourish matching the mockup's "MMXXVII" style — not a full numeral
  // converter, just enough range for a golf trip that started in the 2020s.
  const numerals: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let n = year;
  let result = "";
  for (const [value, symbol] of numerals) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

export default async function ChampionsPage() {
  const supabase = await createClient();

  const { data: seasonsCore } = await supabase
    .from("seasons")
    .select("id, year, name")
    .order("year", { ascending: false });

  // Fetched separately so a database that hasn't run 0020 (the trophy columns) yet still
  // shows the season list — same reasoning as rounds.skins_buy_in in /admin and /money.
  const { data: trophies } = await supabase
    .from("seasons")
    .select("id, cup_winner_team_id, individual_champion_player_id, skins_king_player_id");
  const trophiesBySeasonId = new Map((trophies ?? []).map((t) => [t.id, t]));

  const seasons: Season[] = (seasonsCore ?? []).map((s) => ({
    ...s,
    cup_winner_team_id: trophiesBySeasonId.get(s.id)?.cup_winner_team_id ?? null,
    individual_champion_player_id:
      trophiesBySeasonId.get(s.id)?.individual_champion_player_id ?? null,
    skins_king_player_id: trophiesBySeasonId.get(s.id)?.skins_king_player_id ?? null,
  }));

  const { data: teams } = await supabase.from("teams").select("id, name");
  const { data: players } = await supabase.from("players").select("id, name");

  const teamName = (id: string | null) =>
    id ? teams?.find((t) => t.id === id)?.name ?? "?" : null;
  const playerName = (id: string | null) =>
    id ? players?.find((p) => p.id === id)?.name ?? "?" : null;

  return (
    <main className={styles.page}>
      <Link href="/" className={pageStyles.backLink}>
        ← Home
      </Link>
      <div className={styles.eyebrow}>
        Champions wall · <b>the franchise begins</b>
      </div>

      {seasons.map((season) => {
        const cup = teamName(season.cup_winner_team_id);
        const lowMan = playerName(season.individual_champion_player_id);
        const skinsKing = playerName(season.skins_king_player_id);

        return (
          <div className={styles.plinth} key={season.id}>
            <h2 className={styles.masthead}>THE GUI INVITATIONAL</h2>
            <div className={styles.yr}>
              {season.name.toUpperCase()} · {romanish(season.year)}
            </div>
            <div className={styles.trophyline}>
              The Cup
              <b className={cup ? styles.won : undefined}>{cup ?? "— in play —"}</b>
            </div>
            <div className={styles.trophyline}>
              Low Man
              <b className={lowMan ? styles.won : undefined}>{lowMan ?? "— in play —"}</b>
            </div>
            <div className={styles.trophyline}>
              Skins King
              <b className={skinsKing ? styles.won : undefined}>{skinsKing ?? "— in play —"}</b>
            </div>
          </div>
        );
      })}

      {seasons.length === 0 && <p className={styles.hint}>No seasons yet.</p>}

      <div className={styles.footnote}>
        Names etched March 28, 2027 · then every year after
      </div>
    </main>
  );
}
