import Link from "next/link";
import { Card } from "../design-preview/components/Card";
import styles from "./hedges.module.css";

/** Honest "being rebuilt" screen (Brief 33 Part F): no data reads, so it can never throw. */
export function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <main className={styles.placeholder}>
      <Link href="/" className={styles.back}>
        ← Home
      </Link>
      <h1 className={styles.title}>{title}</h1>
      <Card>
        <p className={styles.body}>{message}</p>
      </Card>
    </main>
  );
}
