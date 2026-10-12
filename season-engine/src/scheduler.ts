// Knight FM — season engine: planificador de oleadas (wave packer).
//
// Reglas implementadas (dato fijo del enunciado):
//  1. En ningún instante hay más de MAX_CONCURRENT_SIMS partidos ocupando hueco.
//  2. Los 8 partidos de una división y jornada empiezan a la vez (lote indivisible
//     de 8 huecos). Un lote del Mundial (20) se parte en tandas ≤ capacidad libre.
//  3. Oleadas consecutivas de duración fija por tipo; sin horas escritas a mano.
//  4. Descanso MIN_REST_MIN entre partidos de un equipo (dura): entre bloques que
//     comparten equipos (o contienen placeholders, cuyos equipos son desconocidos)
//     se inserta siempre el hueco de descanso completo.
//  5. Días dobles (9 y 19): la segunda jornada usa el MISMO orden de lotes → el
//     descanso J9→J10 es uniforme y máximo para todos los equipos.
//  6. J29/J30 (días 27-28): divisiones adyacentes de una región comparten oleada.
//  7. Eliminatorias reservan siempre el peor caso (930 s).
//  9. Todo termina antes de DAY_END_UTC; si no → error explicativo, sin desbordar.

import { seedFromString } from "./rng";
import { slotSeconds, checkCapacity, USEFUL_MIN_PER_DAY } from "./capacity";
import { jornadasForDay } from "./league";
import { CUP_ROUNDS } from "./cup";
import type { DayBlock, MatchInput, PlannerFailure, ScheduledMatch, Wave } from "./types";
import type { SeasonConfig } from "./config";

export const WC_STAGE_ORDER = [
  "L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8",
  "PO-I", "PO-II", "O16-I", "O16-II", "QF-I", "QF-II", "SF-I", "SF-II", "F",
];

export class SeasonPlanError extends Error {
  failures: PlannerFailure[];
  constructor(message: string, failures: PlannerFailure[]) {
    super(message);
    this.name = "SeasonPlanError";
    this.failures = failures;
  }
}

const blockOrder = (m: MatchInput): number => {
  if (m.competition === "LIGA") return Number(m.round.slice(1)); // J9 → 9 (orden numérico)
  if (m.competition === "MUNDIAL" && m.round.startsWith("L")) return 500 + WC_STAGE_ORDER.indexOf(m.round); // fase de liga: tras la liga, antes de la copa
  if (m.competition === "COPA") return 1000 + CUP_ROUNDS.indexOf(m.round as never);
  return 2000 + WC_STAGE_ORDER.indexOf(m.round);
};

/** Bloques de un día en orden: LIGA → MUNDIAL (fase de liga) → COPA → MUNDIAL (KO). */
export function dayBlocks(day: number, matches: MatchInput[], dayHasWcLeague: boolean): DayBlock[] {
  const of = matches.filter((m) => m.day === day);
  const blocks = new Map<string, DayBlock>();
  for (const m of of) {
    const label =
      m.competition === "LIGA" ? `LIGA ${m.round}` : m.competition === "COPA" ? `COPA ${m.round}` : `MUNDIAL ${m.round}`;
    let b = blocks.get(label);
    if (!b) {
      b = {
        kind: m.competition === "LIGA" && m.round.startsWith("J") ? "LEAGUE" : "KO",
        competition: m.competition,
        label,
        matches: [],
        hasPlaceholder: false,
        teamSet: new Set(),
      };
      blocks.set(label, b);
    }
    b.matches.push(m);
    if (m.placeholder) b.hasPlaceholder = true;
    else {
      b.teamSet.add(m.home);
      b.teamSet.add(m.away);
    }
  }
  return [...blocks.values()]
    .sort((a, b) => blockOrder(a.matches[0]!) - blockOrder(b.matches[0]!) || a.label.localeCompare(b.label))
    .map((b) => ({ ...b, matches: sortBlockMatches(b, dayHasWcLeague) }));
}

/** Orden interno de lotes dentro del bloque (reglas 5 y 6 + apoyo al Mundial).
 * · Días con fase de liga del Mundial: divisiones 1ª PRIMERO → los 40 clubes del
 *   Mundial terminan su liga al inicio del día y el bloque del Mundial puede
 *   entrar sin hueco extra (descanso garantizado ≥ 120 min por construcción).
 * · Días dobles (9/19): ambas jornadas con el MISMO orden → descanso uniforme.
 * · Días 27-28 (J29/J30): divisiones adyacentes de una región comparten oleada. */
function sortBlockMatches(b: DayBlock, dayHasWcLeague: boolean): MatchInput[] {
  const day = b.matches[0]!.day;
  const key = (m: MatchInput): number[] => {
    if (b.competition === "LIGA") {
      if (day === 27 || day === 28) {
        const pairIdx = Math.floor((m.division! - 1) / 2);
        return [m.region!, pairIdx, m.division!];
      }
      if (dayHasWcLeague) return [m.division === 1 ? 0 : 1, m.region!, m.division!];
      return [m.region!, m.division!];
    }
    if (b.competition === "COPA") return [m.region!, 0];
    return [0, 0]; // mundial: orden de fase ya implícito
  };
  return [...b.matches].sort((x, y) => {
    const kx = key(x);
    const ky = key(y);
    for (let i = 0; i < kx.length; i++) {
      if (kx[i] !== ky[i]) return kx[i]! - ky[i]!;
    }
    return x.key.localeCompare(y.key);
  });
}

function hhmmss(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

export interface ScheduleResult {
  scheduled: ScheduledMatch[];
  waves: Wave[];
  lastEndByDay: Map<number, number>;
}

export function scheduleSeason(matches: MatchInput[], cfg: SeasonConfig): ScheduleResult {
  // 1) pre-chequeo agregado de capacidad (falla rápido, lista TODOS los días malos)
  const cap = checkCapacity(matches, cfg);
  if (cap.failures.length > 0) {
    const detail = cap.failures.map((f) => f.detail).join("\n");
    throw new SeasonPlanError(
      `Capacidad insuficiente (MAX_CONCURRENT_SIMS=${cfg.sim.maxConcurrentSims}):\n${detail}\n` +
        `C_min requerido: ${Math.max(...cap.failures.map((f) => f.cMinNeeded))} simultáneos. ` +
        `Sugerencias (no aplicadas): subir MAX_CONCURRENT_SIMS, reducir MATCH_DURATION/SIM_MARGIN o redistribuir el calendario.`,
      cap.failures,
    );
  }

  // 2) empaquetado por día
  const days = [...new Set(matches.map((m) => m.day))].sort((a, b) => a - b);
  const scheduled: ScheduledMatch[] = [];
  const waves: Wave[] = [];
  const lastEndByDay = new Map<number, number>();
  const dayEndSec = USEFUL_MIN_PER_DAY * 60; // 24:00 UTC (DAY_END configurable en producción)
  const restSec = cfg.sim.minRestMin * 60;
  const lanes = cfg.sim.maxConcurrentSims;
  const leagueBatchLanes = 8;
  const batchesPerWave = Math.floor(lanes / leagueBatchLanes);

  for (const day of days) {
    const dayHasWcLeague = matches.some(
      (m) => m.day === day && m.competition === "MUNDIAL" && m.round.startsWith("L"),
    );
    const blocks = dayBlocks(day, matches, dayHasWcLeague);
    let cursor = 0;
    let waveIdx = 0;
    let sawPlaceholder = false;
    const lastEnd = new Map<string, number>(); // fin del último partido YA colocado del equipo (ese día)

    for (const b of blocks) {
      // Inicio del bloque = regla unificada de descanso (regla 4, dura):
      //  · Bloque con placeholders (rivales desconocidos) → conservador:
      //    cursor + MIN_REST (cualquier equipo pudo jugar en cualquier bloque previo).
      //  · Bloque concreto → max(cursor, fin del último partido de CADA equipo + MIN_REST):
      //    si todos sus equipos llevan suficiente descanso, el bloque entra SIN hueco.
      let start: number;
      if (b.hasPlaceholder || sawPlaceholder) {
        start = cursor === 0 ? 0 : cursor + restSec;
      } else {
        start = cursor;
        for (const t of b.teamSet) {
          const le = lastEnd.get(t);
          if (le !== undefined) start = Math.max(start, le + restSec);
        }
      }
      const placeWave = (chunk: MatchInput[], lanes_: number, startSec: number, endSec: number): void => {
        const wave: Wave = {
          id: `D${day}-W${waveIdx++}`,
          day,
          startSec,
          endSec,
          lanes: lanes_,
          matchKeys: chunk.map((m) => m.key),
        };
        for (const m of chunk) {
          scheduled.push(finalize(m, startSec, endSec, wave.id, scheduled.length, cfg));
          if (!m.placeholder) {
            lastEnd.set(m.home, endSec);
            lastEnd.set(m.away, endSec);
          }
        }
        waves.push(wave);
      };
      if (b.kind === "LEAGUE") {
        // lotes de división (8 partidos simultáneos, indivisibles);
        // hasta batchesPerWave lotes comparten oleada (8 × batchesPerWave = carriles)
        const chunkSize = leagueBatchLanes * batchesPerWave;
        for (let i = 0; i < b.matches.length; i += chunkSize) {
          const batch = b.matches.slice(i, i + chunkSize);
          const end = start + slotSeconds(false, cfg);
          placeWave(batch, batch.length, start, end);
          start = end;
        }
        cursor = start;
      } else {
        // KO: tandas ≤ capacidad libre; duración de tanda = peor caso reservado
        // de SUS partidos (eliminatoria 930 s; fase de liga del Mundial 630 s)
        const perWave = Math.max(1, Math.min(lanes, b.matches.length));
        for (let i = 0; i < b.matches.length; i += perWave) {
          const chunk = b.matches.slice(i, i + perWave);
          const end = start + Math.max(...chunk.map((m) => slotSeconds(m.ko, cfg)));
          placeWave(chunk, chunk.length, start, end);
          start = end;
        }
        cursor = start;
      }
      if (b.hasPlaceholder) sawPlaceholder = true;
    }
    lastEndByDay.set(day, cursor);
    if (cursor > dayEndSec) {
      const loadMin = Math.round(
        blocks.reduce((acc, bl) => acc + bl.matches.reduce((a, m) => a + slotSeconds(m.ko, cfg), 0), 0) / 60,
      );
      throw new SeasonPlanError(
        `Ventana del día agotada: día ${day} termina en ${hhmmss(cursor)} (> DAY_END_UTC). ` +
          `Carga ${loadMin} min, capacidad ${Math.round((lanes * dayEndSec) / 60)} min, ` +
          `C_min necesario ${Math.ceil((loadMin * 60) / (dayEndSec * cfg.sim.maxUtilization))}.`,
        [
          {
            day,
            loadMin,
            capacityMin: Math.round((lanes * dayEndSec) / 60),
            deficitMin: Math.round(cursor / 60) - USEFUL_MIN_PER_DAY,
            cMinNeeded: Math.ceil((loadMin * 60) / (dayEndSec * cfg.sim.maxUtilization)),
            reason: "VENTANA",
            detail: `El día ${day} no cabe en la ventana útil.`,
          },
        ],
      );
    }
  }
  return { scheduled, waves, lastEndByDay };
}

function finalize(m: MatchInput, start: number, end: number, waveId: string, idx: number, cfg: SeasonConfig): ScheduledMatch {
  return {
    ...m,
    startSec: start,
    reservedEndSec: end,
    slotId: `${waveId}:${idx}`,
    waveId,
    simSeed: `${cfg.seed}|S${cfg.season.number}|${m.competition}|${m.round}|${m.leg}|${m.home}|${m.away}`,
  };
}

/** Jornadas que caen en un día (para el informe de bloques). */
export function leagueJornadasOfDay(day: number): number[] {
  return jornadasForDay(day);
}

export { seedFromString };
