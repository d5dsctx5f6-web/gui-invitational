import styles from "./Button.module.css";

interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

export function Button({ variant = "primary", children, onClick, disabled }: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.button} ${styles[variant]}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
