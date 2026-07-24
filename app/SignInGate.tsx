"use client";

import { useState } from "react";
import pageStyles from "./page.module.css";
import { SignInModal } from "./SignInModal";

interface Player {
  id: string;
  name: string;
}

/**
 * Brief 12: the compact trigger for signed-out gates on /score, /duos, /money — the modal
 * auto-opens since there's nothing else to do on these pages until you're signed in, but stays
 * dismissible (backdrop tap / ×) and re-openable via the button underneath.
 */
export function SignInGate({ players }: { players: Player[] }) {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button className={pageStyles.scoreLink} onClick={() => setOpen(true)}>
        Sign in
      </button>
      <SignInModal
        players={players}
        currentPlayer={null}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
