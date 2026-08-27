"use client";

import { useState } from "react";
import styles from "./Stepper.module.css";

interface StepperProps {
  initialValue?: number;
  min?: number;
}

export function Stepper({ initialValue = 4, min = 1 }: StepperProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className={styles.stepper}>
      <button
        type="button"
        className={styles.dec}
        onClick={() => setValue((v) => Math.max(min, v - 1))}
        aria-label="Decrease"
      >
        −
      </button>
      <span className={styles.value}>{value}</span>
      <button
        type="button"
        className={styles.inc}
        onClick={() => setValue((v) => v + 1)}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
