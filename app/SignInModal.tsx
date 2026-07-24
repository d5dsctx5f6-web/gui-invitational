"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import pageStyles from "./page.module.css";
import styles from "./SignInModal.module.css";

interface Player {
  id: string;
  name: string;
}

interface CurrentPlayer {
  id: string;
  name: string;
}

type Step =
  | { step: "roster" }
  | { step: "pin"; player: Player; mode: "set" | "verify" };

/**
 * Brief 12: sign-in as a bottom-sheet modal (mockup's .sheet/.sheetback pattern) instead of a
 * full-page navigation. Success calls router.refresh() — the current route's Server Components
 * re-fetch with the new session, no hard reload, no URL change.
 *
 * Only mounted while `open` is true, so every open gets fresh internal state for free — no
 * effect-based reset needed.
 */
export function SignInModal({
  players,
  currentPlayer,
  open,
  onClose,
  preselectedPlayer = null,
}: {
  players: Player[];
  currentPlayer: CurrentPlayer | null;
  open: boolean;
  onClose: () => void;
  /** Skip the roster step and go straight to PIN entry for this player (e.g. tapped from a
   *  roster list already on the page). */
  preselectedPlayer?: Player | null;
}) {
  if (!open) return null;
  return (
    <SignInSheet
      players={players}
      currentPlayer={currentPlayer}
      onClose={onClose}
      preselectedPlayer={preselectedPlayer}
    />
  );
}

function SignInSheet({
  players,
  currentPlayer,
  onClose,
  preselectedPlayer,
}: {
  players: Player[];
  currentPlayer: CurrentPlayer | null;
  onClose: () => void;
  preselectedPlayer: Player | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ step: "roster" });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sessionReady = useRef(false);

  // Establish an anonymous device session eagerly, so auth.uid() is ready by the time a
  // player picks their name. No email, no password — this is invisible plumbing.
  useEffect(() => {
    if (sessionReady.current) return;
    sessionReady.current = true;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        supabase.auth.signInAnonymously();
      }
    });
  }, []);

  // If a player was already picked before the modal opened (a roster tap on the home page),
  // resolve straight to their PIN step. The result lands via .then(), not synchronously in the
  // effect body, so this doesn't fight React's cascading-render guard.
  useEffect(() => {
    if (!preselectedPlayer) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .rpc("player_has_pin", { p_player_id: preselectedPlayer.id })
      .then(({ data: hasPin }) => {
        if (!cancelled) {
          setStep({ step: "pin", player: preselectedPlayer, mode: hasPin ? "verify" : "set" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedPlayer]);

  async function selectPlayer(player: Player) {
    setError(null);
    setPin("");
    const supabase = createClient();
    const { data: hasPin } = await supabase.rpc("player_has_pin", {
      p_player_id: player.id,
    });
    setStep({ step: "pin", player, mode: hasPin ? "verify" : "set" });
  }

  async function submitPin() {
    if (step.step !== "pin") return;
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Belt-and-suspenders: the effect above should have already signed us in anonymously,
    // but make sure before calling an RPC that requires auth.uid().
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      await supabase.auth.signInAnonymously();
    }

    const rpcName = step.mode === "set" ? "set_player_pin" : "verify_and_link_pin";
    const { data: ok, error: rpcError } = await supabase.rpc(rpcName, {
      p_player_id: step.player.id,
      p_pin: pin,
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!ok) {
      setError(
        step.mode === "set"
          ? "That PIN was already set — try entering it instead."
          : "Wrong PIN — try again.",
      );
      if (step.mode === "set") {
        setStep({ ...step, mode: "verify" });
      }
      return;
    }

    setPin("");
    onClose();
    router.refresh();
  }

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Sign in">
        {step.step === "roster" ? (
          <>
            <div className={styles.sheethead}>
              <div className={styles.sheettitle}>Sign in</div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <ul className={styles.rosterList}>
              {players.map((player) => (
                <li key={player.id} className={styles.rosterItem}>
                  <button className={styles.rosterButton} onClick={() => selectPlayer(player)}>
                    {player.name}
                    {currentPlayer?.id === player.id && (
                      <span className={styles.youBadge}>you</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className={styles.sheethead}>
              <div className={styles.sheettitle}>
                {step.mode === "set" ? "Set a PIN" : "Enter PIN"}
              </div>
              <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
                ×
              </button>
            </div>
            <div className={styles.pinBox}>
              <div className={pageStyles.pinTitle}>
                {step.mode === "set" ? "Set a PIN for" : "Enter PIN for"}{" "}
                <b>{step.player.name}</b>
              </div>
              <input
                className={pageStyles.pinInput}
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                autoFocus
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
              {error && <div className={pageStyles.pinError}>{error}</div>}
              <div className={pageStyles.pinActions}>
                <button
                  className={pageStyles.pinCancel}
                  onClick={() => setStep({ step: "roster" })}
                >
                  Back
                </button>
                <button className={pageStyles.pinSubmit} disabled={busy} onClick={submitPin}>
                  {busy ? "…" : step.mode === "set" ? "Set PIN" : "Sign in"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
