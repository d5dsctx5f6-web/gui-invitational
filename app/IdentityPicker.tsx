"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface Player {
  id: string;
  name: string;
}

interface CurrentPlayer {
  id: string;
  name: string;
}

type PickerState =
  | { step: "idle" }
  | { step: "pin"; player: Player; mode: "set" | "verify" };

export function IdentityPicker({
  players,
  currentPlayer,
}: {
  players: Player[];
  currentPlayer: CurrentPlayer | null;
}) {
  const [picker, setPicker] = useState<PickerState>({ step: "idle" });
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

  async function selectPlayer(player: Player) {
    setError(null);
    setPin("");
    const supabase = createClient();
    const { data: hasPin } = await supabase.rpc("player_has_pin", {
      p_player_id: player.id,
    });
    setPicker({ step: "pin", player, mode: hasPin ? "verify" : "set" });
  }

  async function submitPin() {
    if (picker.step !== "pin") return;
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

    const rpcName = picker.mode === "set" ? "set_player_pin" : "verify_and_link_pin";
    const { data: ok, error: rpcError } = await supabase.rpc(rpcName, {
      p_player_id: picker.player.id,
      p_pin: pin,
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    if (!ok) {
      setError(
        picker.mode === "set"
          ? "That PIN was already set — try entering it instead."
          : "Wrong PIN — try again.",
      );
      if (picker.mode === "set") {
        setPicker({ ...picker, mode: "verify" });
      }
      return;
    }

    window.location.reload();
  }

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
              onClick={() => selectPlayer(player)}
            >
              {player.name}
              {currentPlayer?.id === player.id && (
                <span className={styles.youBadge}>you</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {picker.step === "pin" && (
        <div className={styles.pinSheet}>
          <div className={styles.pinTitle}>
            {picker.mode === "set" ? "Set a PIN for" : "Enter PIN for"}{" "}
            <b>{picker.player.name}</b>
          </div>
          <input
            className={styles.pinInput}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            autoFocus
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          {error && <div className={styles.pinError}>{error}</div>}
          <div className={styles.pinActions}>
            <button
              className={styles.pinCancel}
              onClick={() => setPicker({ step: "idle" })}
            >
              Cancel
            </button>
            <button className={styles.pinSubmit} disabled={busy} onClick={submitPin}>
              {busy ? "…" : picker.mode === "set" ? "Set PIN" : "Sign in"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
