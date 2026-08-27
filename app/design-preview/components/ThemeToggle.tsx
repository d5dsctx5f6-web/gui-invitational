"use client";

import { useTheme } from "../ThemeProvider";
import styles from "./ThemeToggle.module.css";

const OPTIONS = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "system", label: "System" },
] as const;

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <div className={styles.toggle} role="radiogroup" aria-label="Theme">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          role="radio"
          aria-checked={preference === opt.key}
          className={`${styles.option} ${preference === opt.key ? styles.active : ""}`}
          onClick={() => setPreference(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
