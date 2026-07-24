"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { SignInModal } from "./SignInModal";

interface Player {
  id: string;
  name: string;
}

interface CurrentPlayer {
  id: string;
  name: string;
}

/**
 * Brief 12: the roster stays a browsable list right on the home page (nice to see who's on the
 * trip), but tapping a name now opens PIN entry as a modal over the page instead of expanding an
 * inline sheet beneath the list.
 */
export function IdentityPicker({
  players,
  currentPlayer,
}: {
  players: Player[];
  currentPlayer: CurrentPlayer | null;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ width: "100%" }}>
      {currentPlayer && (
        <div className={styles.signedInBanner}>
          Signed in as <b>{currentPlayer.name}</b>
        </div>
      )}

      <ul className={styles.roster}>
        {players.map((player) => (
          <li key={player.id} className={styles.rosterItem}>
            <button
              className={styles.rosterButton}
              onClick={() => {
                setSelectedPlayer(player);
                setOpen(true);
              }}
            >
              {player.name}
              {currentPlayer?.id === player.id && (
                <span className={styles.youBadge}>you</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      <SignInModal
        players={players}
        currentPlayer={currentPlayer}
        open={open}
        onClose={() => setOpen(false)}
        preselectedPlayer={selectedPlayer}
      />
    </div>
  );
}
