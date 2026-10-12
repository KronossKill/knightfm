// Knight FM — season engine: configuración externa (JSON). Sin números mágicos
// en el código: todo parámetro del modelo de capacidad y del calendario vive aquí.

import { readFileSync } from "node:fs";
import { seedFromString } from "./rng";

export interface SeasonConfig {
  season: { number: number };
  world: { regions: number; divisions: number; clubsPerDivision: number };
  sim: {
    maxConcurrentSims: number;
    matchDurationSec: number;
    koExtraSec: number;
    simMarginSec: number;
    minRestMin: number;
    maxUtilization: number;
    dayStartUtc: string;
    dayEndUtc: string;
    lockLeadMin: number;
  };
  league: { rounds: number; doubleDays: Record<string, number[]>; completeByDay: number };
  cup: { roundDays: Record<string, number>; prelimDivisions: number[] };
  worldcup: {
    leagueDays: number[];
    knockoutDays: Record<string, number>;
    qualifyPerRegion: number;
    season1Mode: "ranking" | "draw";
    drawDay: number;
  };
  transitions: { promotePerDivision: number; relegatePerDivision: number };
  seed: string;
}

export function loadConfig(path = new URL("../config/default.json", import.meta.url).pathname): SeasonConfig {
  const cfg = JSON.parse(readFileSync(path, "utf8")) as SeasonConfig;
  validateConfig(cfg);
  return cfg;
}

export function validateConfig(cfg: SeasonConfig): void {
  const errs: string[] = [];
  const m = cfg.sim.maxConcurrentSims;
  if (m < 8) errs.push(`maxConcurrentSims=${m} < 8: un lote de división (8 partidos) no cabe.`);
  if (m % 8 !== 0) errs.push(`maxConcurrentSims=${m} debe ser múltiplo de 8 (lotes de liga indivisibles).`);
  if (cfg.sim.maxUtilization <= 0 || cfg.sim.maxUtilization > 1) errs.push("maxUtilization fuera de (0,1].");
  if (cfg.sim.minRestMin < 0) errs.push("minRestMin negativo.");
  if (cfg.world.regions * cfg.world.divisions * cfg.world.clubsPerDivision !== 1600) {
    errs.push("La estructura fija es 10 regiones × 10 divisiones × 16 equipos = 1600.");
  }
  if (errs.length) throw new Error(`Configuración inválida:\n- ${errs.join("\n- ")}`);
}

/** Config derivada para tests negativos / escenarios: clon superficial con override. */
export function withOverrides(cfg: SeasonConfig, o: Partial<SeasonConfig["sim"]>): SeasonConfig {
  const clone: SeasonConfig = JSON.parse(JSON.stringify(cfg));
  Object.assign(clone.sim, o);
  validateConfig(clone);
  return clone;
}

export function seasonSeed(cfg: SeasonConfig, competition: string, round: string): number {
  return seedFromString(`${cfg.seed}|S${cfg.season.number}|${competition}|${round}`);
}
