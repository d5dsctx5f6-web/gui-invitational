import styles from "./StatTile.module.css";

interface StatTileProps {
  label: string;
  value: string | number;
  accent?: "north" | "south" | "none";
}

export function StatTile({ label, value, accent = "none" }: StatTileProps) {
  return (
    <div className={`${styles.tile} ${styles[`accent-${accent}`]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
