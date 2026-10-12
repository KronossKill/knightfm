// Knight FM — season engine: servicio de transiciones de temporada.
// · Día 28 tras la J30: ascensos/descensos (parametrizables) y lista provisional
//   de clasificados al próximo Mundial.
// · Día 29: cierre del lista con la final de copa y sustitución por el 4º (pase).
// · Estados de partido SCHEDULED → LOCKED (LOCK_LEAD_MIN antes) → SIMULATING → FINISHED.
// · Alineaciones: si el jugador no envió alineación se aplica la última válida.
// · Recuperación ante caída: SIMULATING sin resultado se re-simula con su semilla,
//   sin duplicados; la cola de oleadas se recalcula.

import type { Row } from "./standings";
import type { MatchStatus } from "./types";

export interface Movement {
  clubId: string;
  fromDivision: number;
  toDivision: number;
  kind: "ASCENSO" | "DESCENSO";
}

/** Día 28: por defecto 3 suben y 3 bajan por división (parametrizable).
 * division 1: nadie asciende; division 10: nadie desciende. tablesByDivision
 * recibe la tabla FINAL ordenada de cada (región, división). */
export function promoteRelegate(
  tablesByDivision: Map<string, Row[]>, // clave "region:division"
  divisionsCount: number,
  promote: number,
  relegate: number,
): Movement[] {
  const moves: Movement[] = [];
  for (const [key, table] of tablesByDivision) {
    const [r, d] = key.split(":").map(Number) as [number, number];
    if (d > 1) {
      for (const row of table.slice(0, promote)) {
        moves.push({ clubId: row.team, fromDivision: d, toDivision: d - 1, kind: "ASCENSO" });
      }
    }
    if (d < divisionsCount) {
      for (const row of table.slice(Math.max(0, table.length - relegate))) {
        moves.push({ clubId: row.team, fromDivision: d, toDivision: d + 1, kind: "DESCENSO" });
      }
    }
  }
  return moves;
}

/** Día 28: lista provisional (top-3 de cada primera). Día 29: el servicio de
 * Mundial (qualifyFromPrior en worldcup.ts) cierra la lista con los campeones
 * de copa y aplica el pase al 4º cuando procede. */
export function provisionalWcList(tablesDiv1ByRegion: Map<number, Row[]>, qualifyPerRegion: number): string[] {
  const out: string[] = [];
  for (const [, table] of [...tablesDiv1ByRegion].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    for (const row of table.slice(0, qualifyPerRegion)) out.push(row.team);
  }
  return out;
}

/** Máquina de estados de partido. */
export function nextStatus(current: MatchStatus, atKickoffMinusLock: boolean, kickoffReached: boolean): MatchStatus {
  if (current === "SCHEDULED" && atKickoffMinusLock) return "LOCKED";
  if ((current === "SCHEDULED" || current === "LOCKED") && kickoffReached) return "SIMULATING";
  return current;
}

export interface Lineup {
  teamId: string;
  formation: string;
  starters: string[];
  version: number;
}

export interface LineupStore {
  lastValid(teamId: string): Lineup | null;
}

export const DEFAULT_FORMATION = "4-4-2";

/** Cierre de alineaciones: si no hay envío para el partido, se aplica la última
 * válida del equipo; si nunca hubo, la alineación por defecto. */
export function effectiveLineup(store: LineupStore, teamId: string, submitted: Lineup | null): Lineup {
  if (submitted) return submitted;
  const last = store.lastValid(teamId);
  if (last) return last;
  return { teamId, formation: DEFAULT_FORMATION, starters: [], version: 0 };
}

export interface FixtureRuntimeState {
  key: string;
  status: MatchStatus;
  hasResult: boolean;
  simSeed: string;
  waveId: string;
}

export interface RecoveryReport {
  resetToScheduled: string[]; // re-simularán con la MISMA semilla (sin duplicar)
  resumed: string[]; // reanudados (out of scope del motor: los gestiona el simulador)
}

/** Recuperación ante caída a mitad de oleada: los SIMULATING sin resultado
 * vuelven a SCHEDULED conservando su semilla; los jobs fallidos se limpian.
 * Idempotente: relanzar no duplica nada (claves deterministas + INSERT OR IGNORE). */
export function recoverInterrupted(fixtures: FixtureRuntimeState[]): RecoveryReport {
  const report: RecoveryReport = { resetToScheduled: [], resumed: [] };
  for (const f of fixtures) {
    if (f.status === "SIMULATING" && !f.hasResult) {
      report.resetToScheduled.push(f.key);
    } else if (f.status === "SIMULATING" && f.hasResult) {
      report.resumed.push(f.key);
    }
  }
  return report;
}

/** Eliminatoria ida y vuelta: gana el global, SIN gol de visitante;
 * empate global → prórroga y penaltis en la vuelta (el simulador decide el
 * vencedor de los penaltis con la semilla del partido). */
export function tieWinner(
  hg1: number,
  ag1: number, // ida (en casa del equipo A)
  hg2: number,
  ag2: number, // vuelta (en casa del equipo B)
  pensWinner: "A" | "B", // solo consultado si el global queda empatado tras prórroga
): "A" | "B" {
  const globalA = hg1 + ag2;
  const globalB = ag1 + hg2;
  if (globalA > globalB) return "A";
  if (globalB > globalA) return "B";
  return pensWinner;
}
