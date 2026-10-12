// Knight FM — season engine: persistencia (bun:sqlite) + export CSV.
// Idempotencia: claves deterministas y INSERT OR IGNORE → relanzar el job del
// día nunca duplica partidos ni resultados.

import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import type { ScheduledMatch, Wave, ClubRef } from "./types";
import type { SeasonConfig } from "./config";

export function hhmmss(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

export function openDb(path: string): Database {
  const db = new Database(path);
  db.exec(readFileSync(new URL("../persistence/schema.sql", import.meta.url).pathname, "utf8"));
  return db;
}

export function writeSeason(
  db: Database,
  cfg: SeasonConfig,
  clubs: ClubRef[],
  matches: ScheduledMatch[],
  waves: Wave[],
): { fixtures: number; waves: number; clubs: number } {
  const season = cfg.season.number;
  db.exec("BEGIN");
  try {
    db.prepare("INSERT OR IGNORE INTO seasons(number, seed) VALUES (?, ?)").run(season, cfg.seed);
    const insClub = db.prepare("INSERT OR IGNORE INTO clubs(id, name, region, division) VALUES (?, ?, ?, ?)");
    for (const c of clubs) insClub.run(c.id, `Club ${c.id}`, c.region, c.division);
    const insWave = db.prepare("INSERT OR IGNORE INTO waves(id, day, start_utc, end_utc, lanes) VALUES (?, ?, ?, ?, ?)");
    for (const w of waves) insWave.run(w.id, w.day, hhmmss(w.startSec), hhmmss(w.endSec), w.lanes);
    const insFix = db.prepare(
      `INSERT OR IGNORE INTO fixtures
       (id, season, competition, region, division, round, leg, home, away, day,
        kickoff_utc, reserved_end_utc, slot_id, wave_id, status, placeholder, sim_seed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?, ?)`,
    );
    for (const m of matches) {
      insFix.run(
        m.key, season, m.competition, m.region, m.division, m.round, m.leg, m.home, m.away, m.day,
        hhmmss(m.startSec), hhmmss(m.reservedEndSec), m.slotId, m.waveId, m.placeholder ? 1 : 0, m.simSeed,
      );
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const count = (q: string) => (db.query(q).get() as { n: number }).n;
  return {
    fixtures: count("SELECT COUNT(*) n FROM fixtures") ?? 0,
    waves: count("SELECT COUNT(*) n FROM waves") ?? 0,
    clubs: count("SELECT COUNT(*) n FROM clubs") ?? 0,
  };
}

export interface CsvRow {
  dia: number;
  hora_inicio_utc: string;
  hora_fin_reservada_utc: string;
  competicion: string;
  region: string;
  division: string;
  ronda: string;
  local: string;
  visitante: string;
  slot_id: string;
  oleada_id: string;
}

export function toCsvRows(matches: ScheduledMatch[]): CsvRow[] {
  return matches
    .slice()
    .sort((a, b) => a.day - b.day || a.startSec - b.startSec || a.key.localeCompare(b.key))
    .map((m) => ({
      dia: m.day,
      hora_inicio_utc: hhmmss(m.startSec),
      hora_fin_reservada_utc: hhmmss(m.reservedEndSec),
      competicion: m.competition,
      region: m.region === null ? "GLOBAL" : String(m.region),
      division: m.division === null ? "" : String(m.division),
      ronda: m.round,
      local: m.home,
      visitante: m.away,
      slot_id: m.slotId,
      oleada_id: m.waveId,
    }));
}

export function csvString(rows: CsvRow[]): string {
  const head = "dia,hora_inicio_utc,hora_fin_reservada_utc,competicion,region,division,ronda,local,visitante,slot_id,oleada_id";
  const body = rows
    .map((r) =>
      [r.dia, r.hora_inicio_utc, r.hora_fin_reservada_utc, r.competicion, r.region, r.division, r.ronda, r.local, r.visitante, r.slot_id, r.oleada_id].join(","),
    )
    .join("\n");
  return `${head}\n${body}\n`;
}
