"use client";

import { useEffect } from "react";
import styles from "./error.module.css";

// This app has never had a route-segment error boundary. Any unhandled render/hydration error
// — including a stale installed-PWA session hitting a JS chunk from a build that's since been
// replaced by a new deploy — has always fallen through to React's default: the whole tree
// unmounts and the screen goes blank, with nothing to tap to recover. This exists so that class
// of error (whatever triggers it) shows a real "something broke, tap to reload" screen instead.
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.page}>
      <p className={styles.title}>Something went wrong</p>
      <p className={styles.sub}>
        Give it another tap. If it keeps happening, close the app fully and reopen it.
      </p>
      <button className={styles.button} onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
