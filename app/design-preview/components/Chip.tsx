import styles from "./Chip.module.css";

type ChipVariant = "neutral" | "live" | "win" | "loss" | "halve" | "north" | "south";

interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  pulse?: boolean;
}

export function Chip({ children, variant = "neutral", pulse = false }: ChipProps) {
  return (
    <span className={`${styles.chip} ${styles[variant]}`}>
      {pulse && <span className={styles.dot} />}
      {children}
    </span>
  );
}
