// M2 audit artifact (Brief 5 Part F). Prints the full simulated "Year One" trip in
// human-readable form so Chris can hand-check it against his own math. Run with:
//   npm run audit
//
// Every number here comes from engine/src/fixtures/fullTrip.ts via the real engine
// functions — nothing is printed that wasn't computed by the code under test.

import {
  ALL_HOLE_SCORES,
  COURSE_A,
  EARNED_PAIRINGS,
  FULL_TRIP_RANKING,
  INDIVIDUAL_RACE,
  PLAYERS,
  SATURDAY_ENTRANTS,
  SATURDAY_NON_ENTRANTS,
  SATURDAY_RANKING,
  SATURDAY_SKINS,
  SUNDAY_SKINS,
  TEAMS,
  computedMatch,
} from "../engine/src/fixtures/fullTrip";

function teamLabel(teamId: string): string {
  return `${teamId} (${TEAMS[teamId].join(", ")})`;
}

function rankingBlock(title: string, ranking: typeof FULL_TRIP_RANKING) {
  console.log(`\n-- ${title} --`);
  for (const bucket of ranking.buckets) {
    const totals = bucket.teamIds.map((id) => {
      const t = ranking.totals.find((x) => x.teamId === id)!;
      return `${id} (${t.points} pts, ${t.holesWon} holes won)`;
    });
    const tag = bucket.chipOffRequired ? "  <-- CHIP-OFF REQUIRED" : "";
    console.log(`  ${bucket.rank}. ${totals.join(" = ")}${tag}`);
  }
}

console.log("=".repeat(78));
console.log("THE GUI INVITATIONAL -- YEAR ONE -- SIMULATED TRIP AUDIT (M2 gate)");
console.log("=".repeat(78));

console.log("\n-- SATURDAY: SHAMBLE --");
for (const name of ["S-A", "S-B", "S-C", "S-D"]) {
  const m = computedMatch(name);
  console.log(
    `\nMatch ${name}: ${teamLabel(m.fixture.teamAId)} [${m.fixture.duoA.join(" & ")}]` +
      ` vs ${teamLabel(m.fixture.teamBId)} [${m.fixture.duoB.join(" & ")}]`,
  );
  console.log(
    `  F9: ${m.state.front9.winner} ${Math.abs(m.state.front9.holesUp)} (thru ${m.state.front9.thru})` +
      `   B9: ${m.state.back9.winner} ${Math.abs(m.state.back9.holesUp)} (thru ${m.state.back9.thru})` +
      `   18: ${m.state.overall18.winner} ${Math.abs(m.state.overall18.holesUp)} (thru ${m.state.overall18.thru})`,
  );
  console.log(`  Points: A ${m.state.totalPoints.a} -- B ${m.state.totalPoints.b}`);
}

console.log("\n-- SUNDAY: FOUR-BALL (duos reshuffled) --");
for (const name of ["Su-A", "Su-B", "Su-C", "Su-D"]) {
  const m = computedMatch(name);
  console.log(
    `\nMatch ${name}: ${teamLabel(m.fixture.teamAId)} [${m.fixture.duoA.join(" & ")}]` +
      ` vs ${teamLabel(m.fixture.teamBId)} [${m.fixture.duoB.join(" & ")}]`,
  );
  console.log(
    `  F9: ${m.state.front9.winner} ${Math.abs(m.state.front9.holesUp)} (thru ${m.state.front9.thru})` +
      `   B9: ${m.state.back9.winner} ${Math.abs(m.state.back9.holesUp)} (thru ${m.state.back9.thru})` +
      `   18: ${m.state.overall18.winner} ${Math.abs(m.state.overall18.holesUp)} (thru ${m.state.overall18.thru})`,
  );
  console.log(`  Points: A ${m.state.totalPoints.a} -- B ${m.state.totalPoints.b}`);
}

rankingBlock("SATURDAY-ONLY STANDINGS (used for Sunday's earned pairings)", SATURDAY_RANKING);

console.log("\n-- EARNED SUNDAY PAIRINGS --");
if (EARNED_PAIRINGS.status === "determined") {
  for (const m of EARNED_PAIRINGS.matchups) {
    console.log(`  Seed ${m.seedA} v ${m.seedB}: ${teamLabel(m.teamAId)} vs ${teamLabel(m.teamBId)}`);
  }
} else {
  console.log(`  CHIP-OFF REQUIRED among: ${EARNED_PAIRINGS.tiedTeamIds.join(", ")}`);
}

rankingBlock("FULL-TRIP STANDINGS & THE CUP", FULL_TRIP_RANKING);
const cupWinnerBucket = FULL_TRIP_RANKING.buckets[0];
console.log(
  cupWinnerBucket.chipOffRequired
    ? `\nCup: CHIP-OFF REQUIRED among ${cupWinnerBucket.teamIds.join(", ")}`
    : `\nCup winner: ${teamLabel(cupWinnerBucket.teamIds[0])}`,
);

console.log("\n-- INDIVIDUAL NET RACE (both rounds, low to high) --");
for (const [i, s] of INDIVIDUAL_RACE.standings.entries()) {
  console.log(`  ${i + 1}. ${s.playerId} -- ${s.cumulativeNet} (${s.holesPlayed} holes)`);
}
console.log("\nDaily low net:");
for (const low of INDIVIDUAL_RACE.dailyLows) {
  console.log(`  ${low.roundId}: ${low.playerIds.join(", ")} at ${low.net}`);
}

console.log("\n-- REVERSE MULLIGAN --");
const rmRow = ALL_HOLE_SCORES.find(
  (r) => r.playerId === "Chris Deliso" && r.roundId === "SAT" && r.hole === 10,
)!;
console.log(
  `  Saturday, Match S-A, Hole 10: Chris Deliso holes his approach for ${rmRow.strokes}` +
    ` (${COURSE_A.parByHole[9] - rmRow.strokes} under par).`,
);
console.log(`  Team 2 forces a replay -- Chris's replay result: ${rmRow.matchStrokes}.`);
console.log(`    Match sees:            ${rmRow.matchStrokes} (post-replay)`);
console.log(`    Skins / individual see: ${rmRow.strokes} (the real, holed shot)`);

console.log("\n-- SKINS --");
console.log(
  `\nSaturday (${SATURDAY_ENTRANTS.length} entrants; sat out: ${SATURDAY_NON_ENTRANTS.join(", ")}):`,
);
for (const hole of SATURDAY_SKINS.holes) {
  if (hole.status === "won") {
    const win = SATURDAY_SKINS.wins.find((w) => w.resolvingHole === hole.hole)!;
    console.log(
      `  Hole ${hole.hole}: ${hole.winner} wins -- covers holes ${win.coveredHoles.join(",")} (${win.coveredHoles.length} skins)`,
    );
  }
}
console.log(`  Unresolved / void: holes ${SATURDAY_SKINS.voidHoles.join(", ")}`);

console.log(`\nSunday (${Object.keys(PLAYERS).length} entrants, independent pool):`);
if (SUNDAY_SKINS.wins.length === 0) {
  console.log(`  No holes resolved -- entire round void (holes ${SUNDAY_SKINS.voidHoles.join(", ")}).`);
} else {
  for (const win of SUNDAY_SKINS.wins) {
    console.log(`  Hole ${win.resolvingHole}: ${win.winner} wins -- covers ${win.coveredHoles.join(",")}`);
  }
}

console.log("\n-- DO-OVERS --");
const doOverRow = ALL_HOLE_SCORES.find(
  (r) => r.playerId === "Will Petersen" && r.roundId === "SAT" && r.hole === 4,
)!;
console.log(
  `  Will Petersen used his one mulligan on Saturday hole 4 -- counted score: ${doOverRow.strokes}` +
    ` (same value used everywhere: match, skins, individual).`,
);

console.log("\n" + "=".repeat(78));
console.log("Chris: hand-check the numbers above. When your own math matches, M2 is met.");
console.log("=".repeat(78));
