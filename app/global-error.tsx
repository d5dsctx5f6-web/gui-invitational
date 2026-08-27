"use client";

import { useEffect } from "react";

// Catches an error in the root layout itself (rarer than app/error.tsx's segment-level catch —
// e.g. a font/global-CSS import throwing). Next.js requires this file to render its own <html>/
// <body>, since it fully replaces the root layout while active, so it can't rely on globals.css
// or the layout's font variables being loaded — kept self-contained on purpose, inline styles
// only, so it renders no matter what else in the app is broken.
export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          background: "#0e3b2e",
          color: "#f2e9d4",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <p style={{ fontSize: 22, color: "#d8a73b", margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 14, opacity: 0.85, maxWidth: 320, margin: 0 }}>
          Give it another tap. If it keeps happening, close the app fully and reopen it.
        </p>
        <button
          onClick={() => reset()}
          style={{
            marginTop: 8,
            minHeight: 48,
            padding: "14px 28px",
            border: "none",
            borderRadius: 4,
            background: "#e5493b",
            color: "#f7f3e8",
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
