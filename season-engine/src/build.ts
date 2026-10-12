// Knight FM — season engine: orquestador. Genera liga + copa + Mundial y los
// planifica. Función pura (misma configuración → mismo calendario, byte a byte).

import type { ClubRef, LoadRow, MatchInput, ScheduledMatch, Wave } from "./types";
import type { SeasonConfig } from "./config";
import { buildClubs } from "./world";
import { generateLeagueFixtures } from "./league";
import { generateCupRound1, generateCupPlaceholders } from "./cup";
import {
  qualifySeason1,
  drawWcLeaguePhase,
  generateWcLeagueFixtures,
  generateWcKnockoutPlaceholders,
  type WcParticipant,
} from "./worldcup";
import { scheduleSeason } from "./scheduler";
import { slotSeconds, USEFUL_MIN_PER_DAY } from "./capacity";
import { csvString, toCsvRows, hhmmss } from "./persistence";

export interface BuiltSeason {
  cfg: SeasonConfig;
  clubs: ClubRef[];
  scheduled: ScheduledMatch[];
  waves: Wave[];
  csv: string;
  load: LoadRow[];
  participants: WcParticipant[];
  matchInputs: MatchInput[];
}

export function buildSeason(cfg: SeasonConfig): BuiltSeason {
  const clubs = buildClubs(cfg);

  const byDiv = new Map<string, string[]>();
  for (let r = 1; r <= cfg.world.regions; r++) {
    for (let d = 1; d <= cfg.world.divisions; d++) {
      byDiv.set(
        `${r}:${d}`,
        clubs.filter((c) => c.region === r && c.division === d).map((c) => c.id),
      );
    }
  }

  const league = generateLeagueFixtures(cfg, byDiv);

  const cup: MatchInput[] = [];
  for (let r = 1; r <= cfg.world.regions; r++) {
    const prelim = cfg.cup.prelimDivisions.flatMap((d) => byDiv.get(`${r}:${d}`)!);
    if (prelim.length !== 64) throw new Error(`R1 región ${r}: se esperaban 64 equipos, hay ${prelim.length}`);
    cup.push(...generateCupRound1(cfg, r, prelim), ...generateCupPlaceholders(cfg, r));
  }

  const div1ByRegion = new Map<number, string[]>();
  for (let r = 1; r <= cfg.world.regions; r++) div1ByRegion.set(r, byDiv.get(`${r}:1`)!);
  const participants = qualifySeason1(cfg, div1ByRegion);
  const wcDraw = drawWcLeaguePhase(cfg, participants);
  const wcLeague = generateWcLeagueFixtures(cfg, wcDraw);
  const wcKo = generateWcKnockoutPlaceholders(cfg);

  const matchInputs: MatchInput[] = [...league, ...cup, ...wcLeague, ...wcKo];
  const { scheduled, waves } = scheduleSeason(matchInputs, cfg);
  const csv = csvString(toCsvRows(scheduled));
  const load = loadReport(scheduled, cfg);
  return { cfg, clubs, scheduled, waves, csv, load, participants, matchInputs };
}

/** Tabla de carga: partidos por día, partido-minutos, ocupación %, pico y fin. */
export function loadReport(scheduled: ScheduledMatch[], cfg: SeasonConfig): LoadRow[] {
  const byDay = new Map<number, ScheduledMatch[]>();
  for (const m of scheduled) {
    const arr = byDay.get(m.day) ?? [];
    arr.push(m);
    byDay.set(m.day, arr);
  }
  const rows: LoadRow[] = [];
  for (const [day, ms] of [...byDay.entries()].sort((a, b) => a[0] - b[0])) {
    const workSec = ms.reduce((a, m) => a + slotSeconds(m.ko, cfg), 0);
    // barrido de eventos: los fins liberan carril antes de los inicios en t
    const events: [number, number][] = [];
    for (const m of ms) {
      events.push([m.startSec, 1], [m.reservedEndSec, -1]);
    }
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0;
    let peak = 0;
    for (const [, delta] of events) {
      cur += delta;
      peak = Math.max(peak, cur);
    }
    const liga = ms.filter((m) => m.competition === "LIGA").length;
    const copa = ms.filter((m) => m.competition === "COPA").length;
    const mundial = ms.filter((m) => m.competition === "MUNDIAL").length;
    rows.push({
      day,
      liga,
      copa,
      mundial,
      total: ms.length,
      workMin: Math.round(workSec / 60),
      occupancyPct: (workSec / (cfg.sim.maxConcurrentSims * USEFUL_MIN_PER_DAY * 60)) * 100,
      peakConcurrent: peak,
      endUtc: hhmmss(Math.max(...ms.map((m) => m.reservedEndSec))),
    });
  }
  return rows;
}
