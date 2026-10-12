// Knight FM — season engine: generador de LIGA.
// Doble vuelta con método del círculo, 30 jornadas, 8 partidos/jornada/división.
// Orden espejo en la segunda vuelta (jornada 16+k = flip de la 1+k, mismo orden).
// Rachas de localía limitadas a ≤2 (reordenación determinista con semilla).
// Mapa de días: 1-8→J1-J8; 9→J9+J10; 10-18→J11-J19; 19→J20+J21; 20-28→J22-J30.

import { mulberry32, perm, seedFromString, shuffled } from "./rng";
import type { MatchInput } from "./types";
import type { SeasonConfig } from "./config";

/** Método del círculo: n/2 emparejamientos × (n−1) rondas. local = primero. */
export function circleRounds(ids: string[]): [string, string][][] {
  const arr = [...ids];
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) pairs.push([arr[i]!, arr[n - 1 - i]!]);
    rounds.push(pairs);
    // rotar todos menos el fijo (arr[0])
    const last = arr.pop()!;
    arr.splice(1, 0, last);
  }
  return rounds;
}

/** Rachas máximas de misma condición por equipo sobre la secuencia completa. */
function maxVenueRun(seq: [string, string][][]): number {
  const run = new Map<string, { v: string; n: number }>();
  let worst = 0;
  for (const pairs of seq) {
    const seen = new Set<string>();
    for (const [h, a] of pairs) {
      for (const [team, venue] of [
        [h, "H"],
        [a, "A"],
      ] as const) {
        if (seen.has(team)) throw new Error(`Equipo ${team} repetido en la jornada`);
        seen.add(team);
        const cur = run.get(team);
        if (cur && cur.v === venue) cur.n++;
        else run.set(team, { v: venue, n: 1 });
        worst = Math.max(worst, run.get(team)!.n);
      }
    }
  }
  return worst;
}

/** Jornadas 1..30 con venue; segunda vuelta = espejo de la primera (mismo orden).
 *
 * Rachas ≤ 2 GARANTIZADAS por construcción: con el círculo, la posición de cada
 * equipo avanza +1 por ronda (mod n−1), así que cruza la frontera entre el lado
 * "i" y el lado "n−1−i" del polígono exactamente UNA vez por vuelta. Orientando
 * la localía ALTERNANDO por ronda (lado local = i si k par, n−1−i si k impar),
 * cada equipo alterna casa/fuera y solo acumula una racha de 2 en su cruce
 * (teorema de de Werra: exactamente un break por vuelta). maxVenueRun queda
 * como árbitro; si el patrón fallara, enumeración total acotada (2^15) como red
 * de seguridad determinista. */
export function drawLeagueSeason(clubIds: string[], seed: string, roundsTotal = 30): [string, string][][] {
  const rng = mulberry32(seedFromString(seed));
  const base = circleRounds(shuffled(clubIds, rng)); // 15 rondas de 8
  const half = roundsTotal / 2; // 15

  const buildSeq = (order: number[], bits: number[]): [string, string][][] => {
    const firstHalf = order.map((ri, k) =>
      base[ri]!.map(([x, y]) => (bits[k]! === 0 ? [x, y] : [y, x]) as [string, string]),
    );
    return [
      ...firstHalf,
      ...firstHalf.map((p) => p.map(([h, a]) => [a, h] as [string, string])), // espejo
    ];
  };

  const identity = base.map((_, i) => i);
  const reversed = base.map((_, i) => half - 1 - i);
  for (const order of [identity, reversed]) {
    for (const off of [0, 1]) {
      const seq = buildSeq(order, base.map((_, k) => (k + off) % 2));
      if (maxVenueRun(seq) <= 2) return seq;
    }
  }
  for (let mask = 0; mask < 1 << half; mask++) {
    const bits = base.map((_, k) => (mask >> k) & 1);
    const seq = buildSeq(identity, bits);
    if (maxVenueRun(seq) <= 2) return seq;
  }
  void rng;
  throw new Error(`No se encontró orden con rachas ≤2 para ${seed}`);
}

/** Día de temporada de cada jornada (dato fijo del enunciado). */
export function dayForJornada(j: number): number {
  if (j <= 8) return j;
  if (j <= 10) return 9;
  if (j <= 19) return j - 1; // J11→10 ... J19→18
  if (j <= 21) return 19;
  return j - 2; // J22→20 ... J30→28
}

/** Jornadas que se juegan en un día (inverso del mapa). */
export function jornadasForDay(day: number): number[] {
  if (day <= 8) return [day];
  if (day === 9) return [9, 10];
  if (day <= 18) return [day + 1];
  if (day === 19) return [20, 21];
  if (day <= 28) return [day + 2];
  return [];
}

export function generateLeagueFixtures(cfg: SeasonConfig, clubsByDivision: Map<string, string[]>): MatchInput[] {
  const out: MatchInput[] = [];
  for (const [divKey, clubIds] of clubsByDivision) {
    const [r, d] = divKey.split(":").map(Number) as [number, number];
    const seed = `${cfg.seed}|S${cfg.season.number}|LIGA|R${r}D${d}`;
    const jornadas = drawLeagueSeason(clubIds, seed, cfg.league.rounds);
    jornadas.forEach((pairs, idx) => {
      const j = idx + 1;
      for (const [home, away] of pairs) {
        out.push({
          key: `L|J${j}|R${r}D${d}|${home}|${away}`,
          competition: "LIGA",
          region: r,
          division: d,
          round: `J${j}`,
          leg: 0,
          home,
          away,
          day: dayForJornada(j),
          ko: false,
          placeholder: false,
        });
      }
    });
  }
  return out;
}
