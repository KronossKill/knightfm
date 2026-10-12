// Knight FM — season engine: CLI de generación.
// Uso: bun src/generate.ts [ruta-config]
// Genera la temporada completa, escribe out/calendario.csv y out/season.db,
// imprime el análisis de capacidad y la tabla de carga. Sale con código 1 y
// error explicativo si la capacidad configurada no basta.

import { loadConfig } from "./config";
import { buildSeason } from "./build";
import { feasibilityTable, USEFUL_MIN_PER_DAY } from "./capacity";
import { openDb, writeSeason } from "./persistence";
import { SeasonPlanError } from "./scheduler";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const cfgPath = process.argv[2] ?? new URL("../config/default.json", import.meta.url).pathname;
const cfg = loadConfig(cfgPath);
const OUT = new URL("../out/", import.meta.url).pathname;

try {
  const t0 = Date.now();
  const built = buildSeason(cfg);

  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}calendario.csv`, built.csv);
  rmSync(`${OUT}season.db`, { force: true });
  const db = openDb(`${OUT}season.db`);
  const counts = writeSeason(db, cfg, built.clubs, built.scheduled, built.waves);
  db.close();

  console.log("════════════════════════════════════════════════════════════════");
  console.log(`Knight FM — generación de temporada ${cfg.season.number} (semilla: ${cfg.seed})`);
  console.log(`MAX_CONCURRENT_SIMS=${cfg.sim.maxConcurrentSims}  slot liga=${cfg.sim.matchDurationSec + cfg.sim.simMarginSec}s  slot KO=${cfg.sim.matchDurationSec + cfg.sim.koExtraSec + cfg.sim.simMarginSec}s  descanso≥${cfg.sim.minRestMin}min  ocupación≤${(cfg.sim.maxUtilization * 100).toFixed(0)}%`);
  console.log("════════════════════════════════════════════════════════════════");
  console.log("\n── Análisis de capacidad (días críticos) ──────────────────────");
  console.log(feasibilityTable(built.matchInputs, cfg, [8, 16, 24, 32], [3, 7, 9, 19]));
  console.log("\n── Tabla de carga por día ─────────────────────────────────────");
  console.log("día | liga | copa | mundial | total | partido-min | ocupación | pico | fin UTC");
  for (const r of built.load) {
    console.log(
      `${String(r.day).padStart(3)} | ${String(r.liga).padStart(4)} | ${String(r.copa).padStart(4)} | ${String(r.mundial).padStart(7)} | ${String(r.total).padStart(5)} | ${String(r.workMin).padStart(11)} | ${(r.occupancyPct.toFixed(1) + "%").padStart(9)} | ${String(r.peakConcurrent).padStart(4)} | ${r.endUtc}`,
    );
  }
  const tot = built.load.reduce(
    (a, r) => ({ liga: a.liga + r.liga, copa: a.copa + r.copa, mundial: a.mundial + r.mundial, work: a.work + r.workMin }),
    { liga: 0, copa: 0, mundial: 0, work: 0 },
  );
  console.log(`SUM | ${tot.liga} | ${tot.copa} | ${tot.mundial} | ${tot.liga + tot.copa + tot.mundial} | ${tot.work}`);
  console.log("\n── Artefactos ─────────────────────────────────────────────────");
  console.log(`out/calendario.csv  (${built.csv.length.toLocaleString("en-US")} bytes)`);
  console.log(`out/season.db       (clubes: ${counts.clubs}, fixtures: ${counts.fixtures}, oleadas: ${counts.waves})`);
  console.log(`Generado en ${Date.now() - t0} ms. Ventana diaria: ${USEFUL_MIN_PER_DAY} min.`);
} catch (e) {
  if (e instanceof SeasonPlanError) {
    console.error(`\n✗ PLANIFICACIÓN IMPOSIBLE — ${e.message}`);
    process.exit(1);
  }
  throw e;
}
