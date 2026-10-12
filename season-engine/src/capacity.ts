// Knight FM — season engine: modelo de capacidad del servidor de simulación.
// Cada partido ocupa [inicio, inicio + duración reservada + margen]:
//   liga / fase de liga del Mundial → 600 + 30 = 630 s
//   eliminatorias (copa y KO del Mundial) → 600 + 300 + 30 = 930 s (peor caso)
// Ocupación de un día = Σ slots / (MAX_CONCURRENT_SIMS × minutos útiles).
// C_min(día) = partido-minutos / (minutos útiles × MAX_UTILIZATION).
// Si la capacidad no basta → error EXPLICATIVO (día, carga, capacidad, déficit,
// C_min necesario). Nunca se desplaza a otro día ni se desborda en silencio.

import type { MatchInput, PlannerFailure } from "./types";
import type { SeasonConfig } from "./config";

export const USEFUL_MIN_PER_DAY = 24 * 60; // DAY_END_UTC - DAY_START_UTC por defecto (00:00-24:00)

export function slotSeconds(ko: boolean, cfg: SeasonConfig): number {
  const base = cfg.sim.matchDurationSec + (ko ? cfg.sim.koExtraSec : 0);
  return base + cfg.sim.simMarginSec;
}

export interface CapacityCheck {
  perDay: Map<number, { matches: number; workSec: number }>;
  failures: PlannerFailure[];
}

/** Pre-chequeo agregado por día: Σ slots ≤ MAX × útil × MAX_UTILIZATION. */
export function checkCapacity(matches: MatchInput[], cfg: SeasonConfig): CapacityCheck {
  const perDay = new Map<number, { matches: number; workSec: number }>();
  for (const m of matches) {
    const cur = perDay.get(m.day) ?? { matches: 0, workSec: 0 };
    cur.matches++;
    cur.workSec += slotSeconds(m.ko, cfg);
    perDay.set(m.day, cur);
  }
  const usefulSec = USEFUL_MIN_PER_DAY * 60;
  const capacitySec = cfg.sim.maxConcurrentSims * usefulSec * cfg.sim.maxUtilization;
  const failures: PlannerFailure[] = [];
  for (const [day, load] of [...perDay.entries()].sort((a, b) => a[0] - b[0])) {
    if (load.workSec > capacitySec) {
      const loadMin = Math.round(load.workSec / 60);
      const capMin = Math.round(capacitySec / 60);
      failures.push({
        day,
        loadMin,
        capacityMin: capMin,
        deficitMin: loadMin - capMin,
        cMinNeeded: Math.ceil(load.workSec / (usefulSec * cfg.sim.maxUtilization)),
        reason: "UTILIZACION",
        detail: `Día ${day}: ${loadMin} partido-minutos reservados superan la capacidad diaria de ${capMin} min (MAX_CONCURRENT_SIMS=${cfg.sim.maxConcurrentSims}, ocupación máx ${(cfg.sim.maxUtilization * 100).toFixed(0)}%).`,
      });
    }
  }
  return { perDay, failures };
}

/** Tabla de factibilidad para varios valores de MAX_CONCURRENT_SIMS. */
export function feasibilityTable(
  matches: MatchInput[],
  cfg: SeasonConfig,
  maxValues: number[],
  criticalDays: number[],
): string {
  const lines: string[] = [];
  lines.push("MAX | día | carga(min) | capacidad(min) | ocupación | C_min necesario | factible");
  for (const max of maxValues) {
    const probe: SeasonConfig = { ...cfg, sim: { ...cfg.sim, maxConcurrentSims: max } };
    const { perDay } = checkCapacity(matches, probe);
    for (const day of criticalDays) {
      const load = perDay.get(day);
      if (!load) continue;
      const capMin = (max * USEFUL_MIN_PER_DAY * cfg.sim.maxUtilization);
      const loadMin = load.workSec / 60;
      const occ = (load.workSec / (max * USEFUL_MIN_PER_DAY * 60)) * 100;
      const cMin = Math.ceil(load.workSec / (USEFUL_MIN_PER_DAY * 60 * cfg.sim.maxUtilization));
      lines.push(
        `${String(max).padStart(3)} | ${String(day).padStart(3)} | ${String(Math.round(loadMin)).padStart(10)} | ${String(Math.round(capMin)).padStart(14)} | ${occ.toFixed(1).padStart(8)}% | ${String(cMin).padStart(15)} | ${load.workSec <= capMin * 60 ? "SÍ" : "NO"}`,
      );
    }
  }
  return lines.join("\n");
}
