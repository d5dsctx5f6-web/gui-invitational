import styles from "./MatchStatePill.module.css";

type PillState = "north-up" | "south-up" | "all-square" | "live";

interface MatchStatePillProps {
  state: PillState;
  children: React.ReactNode;
}

export function MatchStatePill({ state, children }: MatchStatePillProps) {
  return <span className={`${styles.pill} ${styles[state]}`}>{children}</span>;
}
