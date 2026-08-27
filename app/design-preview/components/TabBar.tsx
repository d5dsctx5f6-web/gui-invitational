"use client";

import { useState } from "react";
import styles from "./TabBar.module.css";

interface TabBarProps {
  tabs: string[];
  defaultTab?: string;
}

export function TabBar({ tabs, defaultTab }: TabBarProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]);

  return (
    <div className={styles.bar} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          className={`${styles.tab} ${active === tab ? styles.active : ""}`}
          onClick={() => setActive(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
