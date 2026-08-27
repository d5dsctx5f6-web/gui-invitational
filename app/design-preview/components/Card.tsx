import styles from "./Card.module.css";

interface CardProps {
  children: React.ReactNode;
  edge?: "north" | "south" | "none";
}

export function Card({ children, edge = "none" }: CardProps) {
  return <div className={`${styles.card} ${styles[`edge-${edge}`]}`}>{children}</div>;
}
