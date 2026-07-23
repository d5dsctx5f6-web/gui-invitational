"use client";

import type { ReactNode } from "react";

/**
 * A submit button for a Server Action form that shows a native confirm() first — the message
 * is computed server-side (dependency counts included) and passed in as a prop, so the confirm
 * dialog can actually say what's about to be deleted, not just "are you sure?".
 */
export function ConfirmDeleteButton({
  confirmMessage,
  className,
  children,
}: {
  confirmMessage: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}
