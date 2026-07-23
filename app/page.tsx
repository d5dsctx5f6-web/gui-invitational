import Link from "next/link";
import { getCurrentPlayer } from "@/lib/auth/player";
import { createClient } from "@/lib/supabase/server";
import { IdentityPicker } from "./IdentityPicker";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: players, error } = await supabase
    .from("players")
    .select("id, name")
    .order("name");
  const currentPlayer = await getCurrentPlayer();

  return (
    <main className={styles.page}>
      <h1 className={styles.masthead}>THE GUI INVITATIONAL</h1>
      <p className={styles.subhead}>YEAR ONE &middot; MMXXVII</p>

      <Link href="/score" className={styles.scoreLink}>
        Score a round →
      </Link>

      <div className={styles.navLinks}>
        <Link href="/duos" className={styles.navLink}>
          Duo submissions
        </Link>
        <Link href="/money" className={styles.navLink}>
          Money
        </Link>
        <Link href="/schedule" className={styles.navLink}>
          Schedule
        </Link>
        <Link href="/champions" className={styles.navLink}>
          Champions wall
        </Link>
      </div>

      <IdentityPicker players={players ?? []} currentPlayer={currentPlayer} />

      <footer className={styles.footer}>
        {error ? `connection failed: ${error.message}` : "connection live"}
      </footer>
    </main>
  );
}
