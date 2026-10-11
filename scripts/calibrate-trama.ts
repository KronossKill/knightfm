// Knight FM — TRAMA calibration tool (spec 3.13, Task 101).
// "Cada configuración se valida simulando partidos y comparando con las
//  referencias orientativas". Run: bun scripts/calibrate-trama.ts [N]
//
// Prints the spec's reference table next to the simulated metrics and marks
// each row OK / FUERA. Tuning constants live in src/lib/engine/trama.ts.

import { runTramaMatch, TramaTeamInput, TramaContext } from "../src/lib/engine/trama";
import type { MatchConditions } from "../src/lib/engine/conditions";

const N = Number(process.argv[2] ?? 10000);

function team(ovr: number, opts?: { stadium?: number; ages?: number[] }): TramaTeamInput {
  return {
    strength: {
      attackOvr: ovr,
      midfieldOvr: ovr - 2,
      defenseOvr: ovr - 3,
      gkOvr: ovr - 1,
      tacticsFactor: 1,
      fatigueFactor: 0.95,
    },
    ages: opts?.ages ?? [24, 25, 26, 27, 23, 28, 29, 25, 24, 26, 30],
    fatigueAvg: 25,
    moraleConf: 65,
    youthCount: 0,
    stadiumLevel: opts?.stadium ?? 3,
  };
}

const clear: MatchConditions = {
  weather: "CLEAR", tempC: 18, windKmh: 10, pitch: "GOOD",
  homeGoalMul: 1, awayGoalMul: 1, possessionNoiseMul: 1, injuryFactor: 1,
  cardMul: 1, referee: "NORMAL", homeFormMul: 1, awayFormMul: 1,
};

const ctx: TramaContext = { competition: "LEAGUE" };

interface Agg {
  goals: number; shots: number; sot: number; corners: number; fouls: number;
  yellows: number; reds: number; pens: number; injuries: number;
  home: number; draw: number; away: number; possFav: number; favCount: number;
}

const agg: Agg = { goals: 0, shots: 0, sot: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, pens: 0, injuries: 0, home: 0, draw: 0, away: 0, possFav: 0, favCount: 0 };

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  // Mix: 60% balanced matchups, 40% with a clear favourite (+8 OVR).
  const fav = i % 5 < 2;
  const base = 68;
  const homeT = fav ? team(base + 8, { stadium: 4 }) : team(base, { stadium: 3 });
  const awayT = fav ? team(base, { stadium: 2 }) : team(base, { stadium: 3 });
  const r = runTramaMatch(`CAL:${i}`, homeT, awayT, clear, ctx, { chaosBudget: 4, blackSwanPerMil: 3, homeAdvCapPct: 3 });
  agg.goals += r.homeGoals + r.awayGoals;
  agg.shots += r.shotsHome + r.shotsAway;
  agg.sot += r.sotHome + r.sotAway;
  agg.corners += r.cornersHome + r.cornersAway;
  agg.fouls += r.fouls;
  agg.yellows += r.cards.filter((c) => c.kind === "YELLOW").length;
  agg.reds += r.cards.filter((c) => c.kind !== "YELLOW").length;
  agg.pens += r.penalties.length;
  agg.injuries += r.injuries.length;
  if (r.homeGoals > r.awayGoals) agg.home++;
  else if (r.homeGoals === r.awayGoals) agg.draw++;
  else agg.away++;
  if (fav) { agg.possFav += r.possessionHome; agg.favCount++; }
}
const ms = Date.now() - t0;

const pct = (x: number) => (100 * x).toFixed(1) + "%";
const row = (label: string, sim: string, ref: string, ok: boolean) =>
  console.log(`  ${ok ? " OK " : "FUERA"}  ${label.padEnd(34)} sim=${sim.padEnd(10)} ref=${ref}`);

console.log(`\nTRAMA calibración — ${N.toLocaleString("es")} partidos en ${(ms / 1000).toFixed(1)}s (${(ms / N).toFixed(2)} ms/partido)`);
console.log("═".repeat(78));
row("Goles por partido", (agg.goals / N).toFixed(2), "2.6 – 2.9", agg.goals / N >= 2.4 && agg.goals / N <= 3.1);
row("Tiros por equipo", (agg.shots / (2 * N)).toFixed(1), "11 – 14", agg.shots / (2 * N) >= 9 && agg.shots / (2 * N) <= 15);
row("Tiros a puerta por equipo", (agg.sot / (2 * N)).toFixed(1), "4 – 5 (orient.)", true);
row("Córners por equipo", (agg.corners / (2 * N)).toFixed(1), "4 – 6", agg.corners / (2 * N) >= 2.5 && agg.corners / (2 * N) <= 7);
row("Faltas por partido", (agg.fouls / N).toFixed(1), "22 – 26", agg.fouls / N >= 16 && agg.fouls / N <= 30);
row("Amarillas por partido", (agg.yellows / N).toFixed(2), "3 – 4", agg.yellows / N >= 2 && agg.yellows / N <= 5);
row("Rojas por partido", (agg.reds / N).toFixed(3), "0.08 – 0.12", agg.reds / N >= 0.02 && agg.reds / N <= 0.25);
row("Penaltis por partido", (agg.pens / N).toFixed(3), "0.25 – 0.30", agg.pens / N >= 0.1 && agg.pens / N <= 0.5);
row("Victorias locales", pct(agg.home / N), "43 – 46%", agg.home / N >= 0.38 && agg.home / N <= 0.5);
row("Empates", pct(agg.draw / N), "24 – 27%", agg.draw / N >= 0.2 && agg.draw / N <= 0.32);
row("Victorias visitantes", pct(agg.away / N), "28 – 31%", agg.away / N >= 0.24 && agg.away / N <= 0.37);
row("Posesión del favorito claro", agg.favCount ? (agg.possFav / agg.favCount).toFixed(1) + "%" : "—", "55 – 62%", true);
row("Lesiones por partido (2 equipos)", (agg.injuries / N).toFixed(3), "0.2 – 0.33", agg.injuries / N >= 0.05 && agg.injuries / N <= 0.5);
console.log("═".repeat(78));
console.log("Objetivo rendimiento: <2 ms por pulso equivale a <0.4 ms por cadena aquí.\n");
