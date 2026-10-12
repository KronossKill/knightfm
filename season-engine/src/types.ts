// Knight FM — season engine: tipos de dominio puro (sin I/O).

export type Competition = "LIGA" | "COPA" | "MUNDIAL";
export type MatchStatus = "SCHEDULED" | "LOCKED" | "SIMULATING" | "FINISHED";

/** Referencia de club. region y division son 1-based (division 1 = primera). */
export interface ClubRef {
  id: string;
  region: number;
  division: number;
}

/** Partido ANTES de planificar (sin hora). home/away = id de club o "TBD" (placeholder). */
export interface MatchInput {
  key: string; // clave determinista única (idempotencia)
  competition: Competition;
  region: number | null; // null = GLOBAL (Mundial)
  division: number | null;
  round: string; // "J9" | "R1".. | "L1".."L8" | "PO-I".. | "F"
  leg: number; // 0 partido único, 1 ida, 2 vuelta
  home: string;
  away: string;
  day: number; // día de temporada 1..30
  ko: boolean; // true → reserva peor caso (prórroga+penaltis)
  placeholder: boolean; // true → rivales dependen de resultados (hueco reservado)
  bomboHome?: number; // solo fase de liga del Mundial
  bomboAway?: number;
}

/** Partido YA planificado (con hueco asignado). */
export interface ScheduledMatch extends MatchInput {
  startSec: number; // segundos desde el inicio del día (UTC)
  reservedEndSec: number; // startSec + duración reservada + margen
  slotId: string;
  waveId: string;
  simSeed: string; // semilla de simulación almacenada (auditoría/re-simulación)
}

/** Oleada: conjunto de partidos que comparten ventana de capacidad. */
export interface Wave {
  id: string;
  day: number;
  startSec: number;
  endSec: number;
  lanes: number; // huecos de simultaneidad usados
  matchKeys: string[];
}

/** Bloque homogéneo de un día (p.ej. una jornada de liga, una ronda de copa). */
export interface DayBlock {
  kind: "LEAGUE" | "KO";
  competition: Competition;
  label: string;
  matches: MatchInput[];
  hasPlaceholder: boolean;
  teamSet: Set<string>; // clubes concretos (sin TBD)
}

export interface PlannerFailure {
  day: number;
  loadMin: number; // partido-minutos del día
  capacityMin: number; // capacidad disponible del día
  deficitMin: number; // cuánto falta
  cMinNeeded: number; // simultaneidad mínima requerida
  reason: "UTILIZACION" | "VENTANA";
  detail: string;
}

export interface LoadRow {
  day: number;
  liga: number;
  copa: number;
  mundial: number;
  total: number;
  workMin: number;
  occupancyPct: number; // workMin / (MAX × minutos útiles) × 100
  peakConcurrent: number;
  endUtc: string; // hora de fin del último partido del día
}
