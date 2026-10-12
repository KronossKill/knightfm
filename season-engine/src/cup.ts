// Knight FM — season engine: COPA REGIONAL (eliminatoria directa, partido único).
// 160 equipos/región → 8 rondas: R1 previa (divisiones 7-10, 64 equipos, 32 partidos),
// R2: 32 ganadores + 96 (div 1-6) = 128 → 64 → 32 → 16 → 8 → 4 → 2 → final.
// Partidos por ronda y región: 32, 64, 32, 16, 8, 4, 2, 1 → 159 por región.
// R1 se sortea al generar la temporada (con semilla). Rondas siguientes: el sorteo
// se ejecuta al terminar la ronda anterior (servicio de transiciones) y el
// planificador RESERVA sus huecos como placeholders (TBD) en el día fijado.

import { mulberry32, seedFromString, shuffled } from "./rng";
import type { MatchInput } from "./types";
import type { SeasonConfig } from "./config";

export const CUP_ROUNDS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "F"] as const;
export type CupRound = (typeof CUP_ROUNDS)[number];

/** Partidos por ronda y región (dato fijo). */
export const CUP_MATCHES_PER_REGION: Record<CupRound, number> = {
  R1: 32, R2: 64, R3: 32, R4: 16, R5: 8, R6: 4, R7: 2, F: 1,
};

/** Equipos que participan en cada ronda y región. */
export const CUP_ENTRANTS_PER_REGION: Record<CupRound, number> = {
  R1: 64, R2: 128, R3: 64, R4: 32, R5: 16, R6: 8, R7: 4, F: 2,
};

/** Sorteo puro: baraja determinista y emparejamiento secuencial. */
export function drawKnockoutPairs(entrants: string[], seed: string): [string, string][] {
  if (entrants.length % 2 !== 0) throw new Error(`Entrantes impares (${entrants.length}) en sorteo ${seed}`);
  const rng = mulberry32(seedFromString(seed));
  const pool = shuffled(entrants, rng);
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < pool.length; i += 2) pairs.push([pool[i]!, pool[i + 1]!]);
  return pairs;
}

/** R1 concreta para una región (divisiones 7-10). */
export function generateCupRound1(cfg: SeasonConfig, region: number, entrantsDiv78910: string[]): MatchInput[] {
  const day = cfg.cup.roundDays["R1"]!;
  const seed = `${cfg.seed}|S${cfg.season.number}|COPA|R${region}|R1`;
  return drawKnockoutPairs(entrantsDiv78910, seed).map(([home, away], i) => ({
    key: `C|R1|R${region}|${i + 1}`,
    competition: "COPA" as const,
    region,
    division: null,
    round: "R1",
    leg: 0,
    home,
    away,
    day,
    ko: true,
    placeholder: false,
  }));
}

/** Placeholders (huecos reservados) de las rondas R2..F para una región. */
export function generateCupPlaceholders(cfg: SeasonConfig, region: number): MatchInput[] {
  const out: MatchInput[] = [];
  for (const round of CUP_ROUNDS.slice(1)) {
    const day = cfg.cup.roundDays[round]!;
    const n = CUP_MATCHES_PER_REGION[round];
    for (let i = 0; i < n; i++) {
      out.push({
        key: `C|${round}|R${region}|${i + 1}`,
        competition: "COPA",
        region,
        division: null,
        round,
        leg: 0,
        home: "TBD",
        away: "TBD",
        day,
        ko: true,
        placeholder: true,
      });
    }
  }
  return out;
}

/** Transición runtime: sorteo de la ronda siguiente con los ganadores (auditado). */
export function drawNextCupRound(
  cfg: SeasonConfig,
  region: number,
  finishedRound: CupRound,
  winners: string[],
  extraEntrants: string[] = [],
): [string, string][] {
  const idx = CUP_ROUNDS.indexOf(finishedRound);
  const next = CUP_ROUNDS[idx + 1];
  if (!next) throw new Error("La final no tiene ronda siguiente");
  const seed = `${cfg.seed}|S${cfg.season.number}|COPA|R${region}|${next}`;
  return drawKnockoutPairs([...winners, ...extraEntrants], seed);
}
