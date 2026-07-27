"use client";

import { useMemo, useState } from "react";
import { computeSkins, runningLedger, skinsPayouts, type SettledBet, type SkinsHoleScore } from "@/engine/src";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeRefetch } from "@/lib/supabase/useRealtimeRefetch";
import styles from "./money.module.css";

interface Round {
  id: string;
  date: string;
  format: string;
  course_id: string;
  skins_buy_in: number | null;
}

interface Player {
  id: string;
  name: string;
}

interface Course {
  id: string;
  name: string;
}

function formatName(format: string): string {
  return format === "shamble" ? "Shamble" : format === "four_ball" ? "Four-ball" : format;
}

interface SkinsEntryRow {
  id: string;
  player_id: string;
  round_id: string;
}

interface HoleScoreRow {
  player_id: string;
  round_id: string;
  hole: number;
  strokes: number;
}

interface BetRow {
  id: string;
  proposer_id: string;
  acceptor_id: string | null;
  terms: string;
  stake: number | null;
  status: string;
  winner_player_id: string | null;
}

function playerName(players: Player[], id: string | null): string {
  if (!id) return "?";
  return players.find((p) => p.id === id)?.name ?? "?";
}

/** Brief 22: same formatting convention as Scorecard.tsx's own formatTeeTime. */
function formatTeeTime(teeTime: string | null): string | null {
  if (!teeTime) return null;
  return new Date(teeTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MoneyScreen({
  rounds,
  selectedRoundId,
  players,
  initialSkinsEntries,
  initialHoleScores,
  initialBets,
  currentPlayerId,
  courses,
  mySkinsCutoffTeeTime,
}: {
  rounds: Round[];
  selectedRoundId: string;
  players: Player[];
  initialSkinsEntries: SkinsEntryRow[];
  initialHoleScores: HoleScoreRow[];
  initialBets: BetRow[];
  currentPlayerId: string;
  courses: Course[];
  mySkinsCutoffTeeTime: string | null;
}) {
  const [skinsEntries, setSkinsEntries] = useState(initialSkinsEntries);
  const [holeScores, setHoleScores] = useState(initialHoleScores);
  const [bets, setBets] = useState(initialBets);
  const [busy, setBusy] = useState(false);

  async function refetchSkinsEntries() {
    const supabase = createClient();
    const { data } = await supabase.from("skins_entries").select("id, player_id, round_id");
    setSkinsEntries(data ?? []);
  }
  async function refetchHoleScores() {
    const supabase = createClient();
    const { data } = await supabase
      .from("hole_scores")
      .select("player_id, round_id, hole, strokes");
    setHoleScores(data ?? []);
  }
  async function refetchBets() {
    const supabase = createClient();
    const { data } = await supabase
      .from("challenge_bets")
      .select("id, proposer_id, acceptor_id, terms, stake, status, winner_player_id");
    setBets(data ?? []);
  }

  useRealtimeRefetch("skins_entries", null, refetchSkinsEntries);
  useRealtimeRefetch("hole_scores", null, refetchHoleScores);
  useRealtimeRefetch("challenge_bets", null, refetchBets);

  // Per-round skins result — every round gets computed (needed for the trip-wide ledger),
  // but only the selected round's is shown in the Skins card. `rounds` is already date-ordered
  // (fetched with .order("date")), so a walk-forward carry is enough: each round's unresolved
  // tail (voidHoles) rides into the next round's pool (Addendum A §2, revised Jul 26 2026).
  const skinsByRound = useMemo(() => {
    const map = new Map<
      string,
      {
        entrantIds: string[];
        result: ReturnType<typeof computeSkins>;
        payouts: Record<string, number>;
        carryIn: number;
      }
    >();
    let carryIn = 0;
    for (const round of rounds) {
      const entrantIds = skinsEntries
        .filter((e) => e.round_id === round.id)
        .map((e) => e.player_id);
      const scores: SkinsHoleScore[] = holeScores
        .filter((s) => s.round_id === round.id)
        .map((s) => ({ playerId: s.player_id, hole: s.hole, strokes: s.strokes }));
      const result = computeSkins(scores, entrantIds, carryIn);
      const payouts = skinsPayouts(result.wins, entrantIds.length, round.skins_buy_in ?? 0);
      map.set(round.id, { entrantIds, result, payouts, carryIn });
      carryIn = result.voidHoles.length;
    }
    return map;
  }, [rounds, skinsEntries, holeScores]);

  const combinedSkinsPayouts = useMemo(() => {
    const combined: Record<string, number> = {};
    for (const { payouts } of skinsByRound.values()) {
      for (const [playerId, amount] of Object.entries(payouts)) {
        combined[playerId] = (combined[playerId] ?? 0) + amount;
      }
    }
    return combined;
  }, [skinsByRound]);

  const settledBets: SettledBet[] = useMemo(
    () =>
      bets
        .filter((b) => b.status === "settled" && b.winner_player_id && b.stake !== null)
        .map((b) => ({
          proposerId: b.proposer_id,
          acceptorId: b.acceptor_id!,
          stake: b.stake!,
          winnerPlayerId: b.winner_player_id!,
        })),
    [bets],
  );

  const ledger = useMemo(
    () => runningLedger(combinedSkinsPayouts, settledBets),
    [combinedSkinsPayouts, settledBets],
  );

  // Brief 24 Part C: the blended net total (ledger, above) is unchanged and stays the one
  // settle-up number — this is purely a by-source breakdown for display. runningLedger() with an
  // empty skins map is exactly the bets' own contribution, since the function only ever adds
  // skins once and then adds/subtracts bet stakes on top — calling it this way twice and reading
  // both parts is mathematically identical to the blended total, no engine change needed.
  const betOnlyLedger = useMemo(() => runningLedger({}, settledBets), [settledBets]);

  const selectedRound = rounds.find((r) => r.id === selectedRoundId)!;
  const selected = skinsByRound.get(selectedRoundId)!;
  const iAmIn = selected.entrantIds.includes(currentPlayerId);
  const hasBuyIn = selectedRound.skins_buy_in !== null && selectedRound.skins_buy_in > 0;
  const selectedRoundLabel = `${courses.find((c) => c.id === selectedRound.course_id)?.name ?? "Unknown course"} — ${formatName(selectedRound.format)}`;
  // Last round in the trip has nowhere left to carry an unresolved tail into (Addendum A §2) —
  // everywhere else, an unresolved tail is en route to the next round's pool, not genuinely void.
  const isLastRound = rounds.indexOf(selectedRound) === rounds.length - 1;

  // Brief 9 Part G: opting in is a deliberate, one-way act — a confirm step gates the write,
  // and once in there's no player-facing opt-out for this round at all (the toggle from
  // Brief 7 is gone). Only /admin can undo a mistaken opt-in now.
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function confirmOptIn() {
    setBusy(true);
    const supabase = createClient();
    await supabase
      .from("skins_entries")
      .insert({ player_id: currentPlayerId, round_id: selectedRoundId });
    setBusy(false);
    setConfirmOpen(false);
    await refetchSkinsEntries();
  }

  const skinsWinners = Object.entries(selected.result.skinsWonByPlayer).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardhead}>
          <h2>Skins — {selectedRoundLabel}</h2>
          <div className={styles.meta}>
            {hasBuyIn ? `$${selectedRound.skins_buy_in}` : "buy-in TBD"} ·{" "}
            {selected.entrantIds.length} in
          </div>
        </div>

        {iAmIn ? (
          <div className={styles.lockedBtn}>You&apos;re in — locked for this round</div>
        ) : confirmOpen ? (
          <div className={styles.confirmBox}>
            <div className={styles.hint}>
              Opt into gross skins for {selectedRoundLabel}? Once you&apos;re in, you can&apos;t
              opt back out this round.
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.smallBtn} onClick={() => setConfirmOpen(false)}>
                Cancel
              </button>
              <button className={styles.toggleBtn} disabled={busy} onClick={confirmOptIn}>
                {busy ? "…" : "Confirm — I'm in"}
              </button>
            </div>
          </div>
        ) : (
          <button className={styles.toggleBtn} onClick={() => setConfirmOpen(true)}>
            Opt in to skins
          </button>
        )}
        <div className={styles.hint}>
          {formatTeeTime(mySkinsCutoffTeeTime)
            ? `Opt in before your tee time (${formatTeeTime(mySkinsCutoffTeeTime)}) — not hard-blocked after`
            : "Opt in before your tee time — not hard-blocked after"}
        </div>

        <div className={styles.hint}>
          Entrants: {selected.entrantIds.map((id) => playerName(players, id)).join(", ") || "none yet"}
        </div>

        {selected.carryIn > 0 && (
          <div className={styles.hint}>
            Includes {selected.carryIn} unresolved skin{selected.carryIn === 1 ? "" : "s"} carried
            in from the prior round&apos;s pool
          </div>
        )}

        {skinsWinners.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {skinsWinners.map(([playerId, holesWon]) => (
              <div className={styles.skinRow} key={playerId}>
                <span>{playerName(players, playerId)}</span>
                <span className={styles.money}>
                  {hasBuyIn
                    ? `$${selected.payouts[playerId]?.toFixed(2) ?? "0.00"}`
                    : `${holesWon} skin${holesWon === 1 ? "" : "s"}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {selected.result.voidHoles.length > 0 && (
          <div className={styles.hint}>
            {isLastRound
              ? `Void (tied through 18): holes ${selected.result.voidHoles.join(", ")} — genuinely unresolved, settle manually`
              : `Tied through 18: holes ${selected.result.voidHoles.join(", ")} — carrying into next round's pool`}
          </div>
        )}
        {selected.result.unresolvedCarryIn > 0 && (
          <div className={styles.hint}>
            Plus {selected.result.unresolvedCarryIn} carried-in skin
            {selected.result.unresolvedCarryIn === 1 ? "" : "s"} from before, still unclaimed —
            settle manually
          </div>
        )}
      </div>

      <ChallengeLedger
        bets={bets}
        players={players}
        currentPlayerId={currentPlayerId}
        onChanged={refetchBets}
      />

      <div className={styles.card}>
        <div className={styles.cardhead}>
          <h2>Running ledger</h2>
          <div className={styles.meta}>skins + settled bets, both rounds</div>
        </div>
        {Object.keys(ledger).length === 0 ? (
          <div className={styles.hint}>Nothing on the books yet.</div>
        ) : (
          Object.entries(ledger)
            .sort((a, b) => b[1] - a[1])
            .map(([playerId, net]) => {
              // Brief 24 Part C: the blended net (below) stays the one settle-up number — this
              // breakdown is purely so the source of that number is scannable at a glance.
              const skinsAmt = combinedSkinsPayouts[playerId] ?? 0;
              const betsAmt = betOnlyLedger[playerId] ?? 0;
              return (
                <div className={styles.ledgerEntry} key={playerId}>
                  <div className={styles.ledgerRow}>
                    <span>{playerName(players, playerId)}</span>
                    <span className={net >= 0 ? styles.moneyUp : styles.moneyDown}>
                      {net >= 0 ? "+" : ""}
                      {net.toFixed(2)}
                    </span>
                  </div>
                  {(skinsAmt !== 0 || betsAmt !== 0) && (
                    <div className={styles.ledgerBreakdown}>
                      {skinsAmt !== 0 && (
                        <span className={styles.ledgerSkins}>
                          Skins {skinsAmt >= 0 ? "+" : ""}
                          {skinsAmt.toFixed(2)}
                        </span>
                      )}
                      {betsAmt !== 0 && (
                        <span className={styles.ledgerBets}>
                          Bets {betsAmt >= 0 ? "+" : ""}
                          {betsAmt.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </>
  );
}

function ChallengeLedger({
  bets,
  players,
  currentPlayerId,
  onChanged,
}: {
  bets: BetRow[];
  players: Player[];
  currentPlayerId: string;
  onChanged: () => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [opponentId, setOpponentId] = useState("");
  const [stake, setStake] = useState("");
  const [terms, setTerms] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logBet() {
    if (!opponentId || !terms.trim()) {
      setError("Pick who you're betting against and describe the terms");
      return;
    }
    const stakeNum = stake.trim() === "" ? null : Number(stake);
    if (stakeNum !== null && Number.isNaN(stakeNum)) {
      setError("Stake must be a number");
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("challenge_bets").insert({
      proposer_id: currentPlayerId,
      acceptor_id: opponentId,
      terms: terms.trim(),
      stake: stakeNum,
      status: "proposed",
    });
    setBusy(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setFormOpen(false);
    setOpponentId("");
    setStake("");
    setTerms("");
    onChanged();
  }

  async function accept(betId: string) {
    const supabase = createClient();
    await supabase.from("challenge_bets").update({ status: "open" }).eq("id", betId);
    onChanged();
  }

  async function settle(betId: string, winnerId: string) {
    const supabase = createClient();
    await supabase
      .from("challenge_bets")
      .update({ status: "settled", winner_player_id: winnerId })
      .eq("id", betId);
    onChanged();
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardhead}>
        <h2>Challenge Ledger</h2>
        <div className={styles.meta}>tap accept to make it official</div>
      </div>

      {bets.length === 0 && <div className={styles.hint}>No bets logged yet.</div>}

      {bets.map((b) => {
        const iAmParty = b.proposer_id === currentPlayerId || b.acceptor_id === currentPlayerId;
        return (
          <div className={styles.betRow} key={b.id}>
            <div>
              <b>{playerName(players, b.proposer_id)}</b> v{" "}
              <b>{playerName(players, b.acceptor_id)}</b>
              {b.stake !== null && ` · $${b.stake}`}
              <div className={styles.hint}>{b.terms}</div>
            </div>
            <div className={styles.betActions}>
              {b.status === "proposed" && b.acceptor_id === currentPlayerId && (
                <button className={styles.smallBtn} onClick={() => accept(b.id)}>
                  Accept
                </button>
              )}
              {b.status === "proposed" && b.acceptor_id !== currentPlayerId && (
                <span className={styles.badge}>pending accept</span>
              )}
              {b.status === "open" && iAmParty && (
                <>
                  <button
                    className={styles.smallBtn}
                    onClick={() => settle(b.id, b.proposer_id)}
                  >
                    {playerName(players, b.proposer_id)} won
                  </button>
                  <button
                    className={styles.smallBtn}
                    onClick={() => settle(b.id, b.acceptor_id!)}
                  >
                    {playerName(players, b.acceptor_id)} won
                  </button>
                </>
              )}
              {b.status === "open" && !iAmParty && <span className={styles.badge}>open</span>}
              {b.status === "settled" && (
                <span className={styles.badge}>
                  {playerName(players, b.winner_player_id)} won
                </span>
              )}
              {b.status === "void" && <span className={styles.badge}>voided</span>}
            </div>
          </div>
        );
      })}

      {formOpen ? (
        <div className={styles.betForm}>
          <select
            className={styles.select}
            value={opponentId}
            onChange={(e) => setOpponentId(e.target.value)}
          >
            <option value="">Bet against…</option>
            {players
              .filter((p) => p.id !== currentPlayerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <input
            className={styles.input}
            type="number"
            placeholder="Stake ($)"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <input
            className={styles.input}
            placeholder="Terms — e.g. closest to the pin on 16"
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
          />
          {error && <div className={styles.errorText}>{error}</div>}
          <div className={styles.betFormActions}>
            <button className={styles.smallBtn} onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button className={styles.smallBtn} disabled={busy} onClick={logBet}>
              {busy ? "…" : "Log it"}
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.logBtn} onClick={() => setFormOpen(true)}>
          + Log a new challenge
        </button>
      )}
    </div>
  );
}
