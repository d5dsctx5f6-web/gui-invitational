import { getSupabase } from "@/lib/supabase";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: players, error } = await getSupabase()
    .from("players")
    .select("id, name")
    .order("name");

  return (
    <main className={styles.page}>
      <h1 className={styles.masthead}>THE GUI INVITATIONAL</h1>
      <p className={styles.subhead}>YEAR ONE &middot; MMXXVII</p>

      <ul className={styles.roster}>
        {(players ?? []).map((player) => (
          <li key={player.id} className={styles.rosterItem}>
            {player.name}
          </li>
        ))}
      </ul>

      <footer className={styles.footer}>
        {error ? `connection failed: ${error.message}` : "connection live"}
      </footer>
    </main>
  );
}
