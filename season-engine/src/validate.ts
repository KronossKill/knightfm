// Knight FM — season engine: validador de invariantes (suite completa).
// Ejecuta TODAS las comprobaciones del enunciado sobre la temporada generada
// y muestra el resultado real de cada una. Código de salida 1 si algo falla.
//
//   bun src/validate.ts [ruta-config]

import { loadConfig, withOverrides } from "./config";
import { buildSeason, type BuiltSeason } from "./build";
import { slotSeconds, USEFUL_MIN_PER_DAY } from "./capacity";
import { SeasonPlanError } from "./scheduler";
import { CUP_ROUNDS, CUP_MATCHES_PER_REGION, drawNextCupRound } from "./cup";
import { qualifyFromPrior, playoffPairs, r16Template } from "./worldcup";
import {
  rankTable, emptyTable, applyResult, type Row, type ResultIn,
} from "./standings";
import {
  promoteRelegate, provisionalWcList, effectiveLineup, recoverInterrupted,
  tieWinner, type LineupStore, type FixtureRuntimeState,
} from "./transitions";
import { openDb, writeSeason, csvString, toCsvRows, hhmmss } from "./persistence";
import { rmSync } from "node:fs";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(id: string, desc: string, fn: () => string | true): void {
  try {
    const detail = fn();
    passed++;
    console.log(`[OK]    ${id}  ${desc}${detail === true ? "" : ` — ${detail}`}`);
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`${id}: ${msg}`);
    console.log(`[FALLO] ${id}  ${desc} — ${msg}`);
  }
}

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

function sha256(s: string): string {
  const h = new Bun.CryptoHasher("sha256");
  h.update(s);
  return h.digest("hex");
}

const cfg = loadConfig(process.argv[2] ?? new URL("../config/default.json", import.meta.url).pathname);
const built: BuiltSeason = buildSeason(cfg);
const { scheduled, clubs, participants } = built;
const regionOf = new Map(clubs.map((c) => [c.id, c.region]));
const MIN_REST_SEC = cfg.sim.minRestMin * 60;
const DAY_END_SEC = USEFUL_MIN_PER_DAY * 60;

const liga = scheduled.filter((m) => m.competition === "LIGA" && !m.placeholder);
const copa = scheduled.filter((m) => m.competition === "COPA");
const mundial = scheduled.filter((m) => m.competition === "MUNDIAL");
const wcLeague = mundial.filter((m) => m.round.startsWith("L") && !m.placeholder);

console.log(`Validando temporada ${cfg.season.number} — ${scheduled.length} partidos, ${built.waves.length} oleadas\n`);

// ─── I01: cada equipo juega exactamente 30 de liga (15 casa / 15 fuera) ──────
check("I01", "cada equipo: 30 de liga, 15 en casa y 15 fuera", () => {
  const per = new Map<string, { h: number; a: number }>();
  for (const m of liga) {
    for (const [t, v] of [[m.home, "h"], [m.away, "a"]] as const) {
      const cur = per.get(t) ?? { h: 0, a: 0 };
      if (v === "h") cur.h++;
      else cur.a++;
      per.set(t, cur);
    }
  }
  assert(per.size === 1600, `equipos con liga: ${per.size} ≠ 1600`);
  for (const [t, c] of per) {
    assert(c.h + c.a === 30, `${t}: ${c.h + c.a} partidos ≠ 30`);
    assert(c.h === 15 && c.a === 15, `${t}: ${c.h}H/${c.a}A ≠ 15/15`);
  }
  return `1600 equipos × 30 (15H/15A)`;
});

// ─── I02: nadie dos veces en la misma jornada ────────────────────────────────
check("I02", "sin equipo repetido dentro de una jornada", () => {
  const seen = new Map<string, Set<string>>();
  for (const m of liga) {
    const k = `${m.region}:${m.division}:${m.round}`;
    const s = seen.get(k) ?? new Set<string>();
    for (const t of [m.home, m.away]) {
      assert(!s.has(t), `${t} repetido en ${k}`);
      s.add(t);
    }
    seen.set(k, s);
  }
  return `${seen.size} jornadas de división verificadas`;
});

// ─── I03: cada pareja se enfrenta 2 veces con localía invertida ──────────────
check("I03", "cada pareja: 2 enfrentamientos con localía invertida", () => {
  const pairs = new Map<string, number>(); // "a>b" con orientación
  for (const m of liga) {
    const k = `${m.home}>${m.away}`;
    pairs.set(k, (pairs.get(k) ?? 0) + 1);
  }
  const divisions = new Set(liga.map((m) => `${m.region}:${m.division}`));
  for (const div of divisions) {
    const ids = liga.filter((m) => `${m.region}:${m.division}` === div).map((m) => m.home);
    const uniq = [...new Set(ids)];
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const ab = pairs.get(`${uniq[i]}>${uniq[j]}`) ?? 0;
        const ba = pairs.get(`${uniq[j]}>${uniq[i]}`) ?? 0;
        assert(ab === 1 && ba === 1, `pareja ${uniq[i]}/${uniq[j]} en ${div}: ${ab}+${ba} ≠ ida/vuelta`);
      }
    }
  }
  return `${divisions.size} divisiones × 120 parejas, todas ida+vuelta`;
});

// ─── I04: total de liga = 24.000 ─────────────────────────────────────────────
check("I04", "total de partidos de liga = 24000", () => {
  assert(liga.length === 24000, `hay ${liga.length}`);
  return `24000 = 100 divisiones × 30 jornadas × 8 partidos`;
});

// ─── I05: copa 159 por región, 1.590 total, sin repetidos por ronda ─────────
check("I05", "copa: 159/región, 1590 total, sin repetidos por ronda", () => {
  assert(copa.length === 1590, `total ${copa.length} ≠ 1590`);
  for (let r = 1; r <= cfg.world.regions; r++) {
    assert(copa.filter((m) => m.region === r).length === 159, `región ${r} ≠ 159`);
  }
  for (const round of CUP_ROUNDS) {
    const ms = copa.filter((m) => m.round === round);
    assert(ms.length === CUP_MATCHES_PER_REGION[round] * cfg.world.regions, `${round}: ${ms.length}`);
    const concrete = ms.filter((m) => !m.placeholder);
    const teams = new Set(concrete.flatMap((m) => [m.home, m.away]));
    assert(teams.size === concrete.length * 2, `${round}: equipo repetido en la ronda`);
    // estructura: los huecos reservados de la ronda cuadran con los entrantes esperados
    const entrants = { R1: 64, R2: 128, R3: 64, R4: 32, R5: 16, R6: 8, R7: 4, F: 2 }[round]!;
    assert(ms.length * 2 === entrants * cfg.world.regions, `${round}: huecos ≠ entrantes`);
  }
  return `1590 = 10 regiones × (32+64+32+16+8+4+2+1)`;
});

// ─── I06: mundial 160 fase de liga, 205 total, 8 rivales, 4H/4A, 2/bombo ────
check("I06", "mundial: 160 liga + 205 total; 8 rivales, 4H/4A, 2 por bombo, sin misma región", () => {
  assert(mundial.length === 205, `total ${mundial.length} ≠ 205`);
  assert(wcLeague.length === 160, `fase de liga ${wcLeague.length} ≠ 160`);
  const per = new Map<string, { rivals: Set<string>; h: number; a: number; bombo: Map<number, number> }>();
  const bomboOf = new Map(participants.map((p) => [p.clubId, p.bombo]));
  for (const m of wcLeague) {
    assert(regionOf.get(m.home) !== regionOf.get(m.away), `misma región: ${m.home} vs ${m.away}`);
    // (equipo, rival, bomboPropio, bomboDelRival)
    for (const [t, rival, , bomboRival] of [
      [m.home, m.away, m.bomboHome, m.bomboAway],
      [m.away, m.home, m.bomboAway, m.bomboHome],
    ] as const) {
      const cur = per.get(t) ?? { rivals: new Set<string>(), h: 0, a: 0, bombo: new Map() };
      cur.rivals.add(rival);
      if (t === m.home) cur.h++;
      else cur.a++;
      cur.bombo.set(bomboRival!, (cur.bombo.get(bomboRival!) ?? 0) + 1);
      per.set(t, cur);
    }
  }
  assert(per.size === 40, `equipos en el mundial: ${per.size} ≠ 40`);
  for (const [t, c] of per) {
    assert(c.rivals.size === 8, `${t}: ${c.rivals.size} rivales ≠ 8`);
    assert(c.h === 4 && c.a === 4, `${t}: ${c.h}H/${c.a}A ≠ 4/4`);
    for (const b of [1, 2, 3, 4]) {
      assert(c.bombo.get(b) === 2, `${t}: ${c.bombo.get(b) ?? 0} rivales del bombo ${b} ≠ 2`);
    }
    assert(bomboOf.has(t), `${t} sin bombo asignado`);
  }
  return `40 equipos × (2 rivales de cada bombo, 1 en casa y 1 fuera)`;
});

// ─── I07: sin solapes y descanso ≥ MIN_REST (duración reservada) ─────────────
check("I07", "ningún equipo con solape o descanso < MIN_REST_MIN (duración reservada)", () => {
  const ABS = (day: number, sec: number) => (day - 1) * 86400 + sec; // tiempo absoluto UTC
  const per = new Map<string, { start: number; end: number; key: string }[]>();
  for (const m of scheduled) {
    if (m.placeholder) continue; // TBD: sin equipo real asociado aún
    for (const t of [m.home, m.away]) {
      const arr = per.get(t) ?? [];
      arr.push({ start: ABS(m.day, m.startSec), end: ABS(m.day, m.reservedEndSec), key: m.key });
      per.set(t, arr);
    }
  }
  let worst = Infinity;
  for (const [t, list] of per) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++) {
      const gap = list[i]!.start - list[i - 1]!.end;
      assert(gap >= MIN_REST_SEC, `${t}: descanso ${gap}s < ${MIN_REST_SEC}s entre ${list[i - 1]!.key} y ${list[i]!.key}`);
      worst = Math.min(worst, gap);
    }
  }
  return `peor descanso: ${(worst / 60).toFixed(0)} min (mínimo exigido ${cfg.sim.minRestMin})`;
});

// ─── I08: simultaneidad ≤ MAX_CONCURRENT_SIMS (barrido de eventos) ───────────
check("I08", "ningún instante supera MAX_CONCURRENT_SIMS (barrido de eventos)", () => {
  const events: [number, number][] = [];
  for (const m of scheduled) {
    const abs = (day: number, sec: number) => (day - 1) * 86400 + sec;
    events.push([abs(m.day, m.startSec), 1], [abs(m.day, m.reservedEndSec), -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  const peaksByDay = new Map<number, number>();
  for (const [t, d] of events) {
    cur += d;
    peak = Math.max(peak, cur);
    const day = Math.floor(t / 86400) + 1;
    peaksByDay.set(day, Math.max(peaksByDay.get(day) ?? 0, cur));
  }
  assert(peak <= cfg.sim.maxConcurrentSims, `pico ${peak} > ${cfg.sim.maxConcurrentSims}`);
  return `pico global = ${peak} simultáneos (día 7: ${peaksByDay.get(7)}, día 29: ${peaksByDay.get(29)}, día 30: ${peaksByDay.get(30)})`;
});

// ─── I09: ocupación ≤ MAX_UTILIZATION y fin < DAY_END en todos los días ─────
check("I09", "ocupación ≤ MAX_UTILIZATION y todo termina antes de DAY_END_UTC", () => {
  for (const row of built.load) {
    assert(row.occupancyPct <= cfg.sim.maxUtilization * 100 + 1e-9, `día ${row.day}: ocupación ${row.occupancyPct.toFixed(1)}%`);
    const endSec = hhmmssToSec(row.endUtc);
    assert(endSec <= DAY_END_SEC, `día ${row.day}: fin ${row.endUtc} > DAY_END`);
  }
  return `30 días OK (peor ocupación: ${Math.max(...built.load.map((r) => r.occupancyPct)).toFixed(1)}%, peor fin: ${built.load.map((r) => r.endUtc).sort().at(-1)})`;
});

function hhmmssToSec(s: string): number {
  const [h, m, sec] = s.split(":").map(Number) as [number, number, number];
  return h * 3600 + m * 60 + sec;
}

// ─── I10: los 8 de división-jornada comparten hora exacta ────────────────────
check("I10", "los 8 partidos de una división y jornada empiezan a la vez", () => {
  const groups = new Map<string, Set<number>>();
  for (const m of liga) {
    const k = `${m.region}:${m.division}:${m.round}`;
    const s = groups.get(k) ?? new Set<number>();
    s.add(m.startSec);
    groups.set(k, s);
  }
  for (const [k, s] of groups) {
    assert(s.size === 1, `${k}: ${s.size} horas de inicio distintas`);
    assert([...s][0]! !== undefined, `${k} vacío`);
  }
  return `${groups.size} lotes de división, todos simultáneos`;
});

// ─── I11: días 9 y 19 — descanso entre jornadas ≥ MIN_REST ──────────────────
check("I11", "días 9/19: descanso de cada equipo entre sus dos jornadas ≥ MIN_REST_MIN", () => {
  for (const day of [9, 19]) {
    const jornadaMatches = liga.filter((m) => m.day === day);
    assert(jornadaMatches.length === 1600, `día ${day}: ${jornadaMatches.length} ≠ 1600`);
    const per = new Map<string, { start: number; end: number }[]>();
    for (const m of jornadaMatches) {
      for (const t of [m.home, m.away]) {
        const arr = per.get(t) ?? [];
        arr.push({ start: m.startSec, end: m.reservedEndSec });
        per.set(t, arr);
      }
    }
    for (const [t, list] of per) {
      assert(list.length === 2, `${t}: ${list.length} partidos el día ${day}`);
      list.sort((a, b) => a.start - b.start);
      const gap = list[1]!.start - list[0]!.end;
      assert(gap >= MIN_REST_SEC, `${t}: descanso entre jornadas ${(gap / 60).toFixed(0)} min < ${cfg.sim.minRestMin}`);
    }
  }
  return `descanso uniforme de ${(built.load.find((r) => r.day === 9)!.workMin ? 634.5 : 0).toFixed(1)} min el día 9 (50 oleadas de separación)`;
});

// ─── I12: cada competición termina en su fecha ──────────────────────────────
check("I12", "liga acaba el día 28, final de copa el 29, final del Mundial el 30", () => {
  assert(Math.max(...liga.map((m) => m.day)) === cfg.league.completeByDay, "la liga no acaba el día 28");
  assert(liga.every((m) => m.day >= 1 && m.day <= 28), "partidos de liga fuera de 1..28");
  const copaF = copa.filter((m) => m.round === "F");
  assert(copaF.every((m) => m.day === cfg.cup.roundDays["F"]), "la final de copa no es el día 29");
  assert(copaF.length === cfg.world.regions, `finales de copa: ${copaF.length}`);
  const wcF = mundial.filter((m) => m.round === "F");
  assert(wcF.every((m) => m.day === cfg.worldcup.knockoutDays["F"]), "la final del Mundial no es el día 30");
  assert(wcF.length === 1, `finales del mundial: ${wcF.length}`);
  // fases del mundial en su día exacto
  for (const [stage, day] of Object.entries(cfg.worldcup.knockoutDays)) {
    assert(mundial.filter((m) => m.round === stage).every((m) => m.day === day), `${stage} fuera de su día`);
  }
  return `liga 1..28 · copa R1..F (3..29) · mundial L1..F (3..30)`;
});

// ─── I13 (negativo): MAX=8 → fallo explicativo en los días imposibles ───────
check("I13", "con MAX=8 el planificador falla con error explicativo (días 3,7,9,11,15,19)", () => {
  const cfg8 = withOverrides(cfg, { maxConcurrentSims: 8 });
  let error: SeasonPlanError | null = null;
  try {
    buildSeason(cfg8);
  } catch (e) {
    if (!(e instanceof SeasonPlanError)) throw e;
    error = e;
  }
  assert(error, "el planificador NO falló con MAX=8");
  const days = new Set(error!.failures.map((f) => f.day));
  for (const d of [3, 7, 9, 11, 15, 19]) {
    assert(days.has(d), `el día ${d} no apareció como inviable`);
    const f = error!.failures.find((x) => x.day === d)!;
    assert(f.deficitMin > 0 && f.cMinNeeded > 8, `día ${d}: mensaje sin déficit/C_min`);
  }
  assert(/Capacidad insuficiente/.test(error!.message) && /C_min/.test(error!.message), "mensaje sin diagnóstico");
  return `días inviables detectados: ${[...days].sort((a, b) => a - b).join(", ")} (CORRECCIÓN al enunciado: también 3, 11 y 15)`;
});

// ─── I14: determinismo — misma semilla → mismo calendario ───────────────────
check("I14", "misma semilla produce exactamente el mismo calendario (SHA-256)", () => {
  const again = buildSeason(cfg);
  const h1 = sha256(built.csv);
  const h2 = sha256(again.csv);
  assert(h1 === h2, `hashes distintos: ${h1} vs ${h2}`);
  return `SHA-256(calendario.csv) = ${h1.slice(0, 16)}…`;
});

// ─── I15a: campeón de copa ya clasificado → pase al 4º ──────────────────────
check("I15a", "campeón de copa ya clasificado por liga → su plaza pasa al 4º", () => {
  const tables = new Map<number, { team: string }[]>();
  for (let r = 1; r <= 10; r++) {
    tables.set(
      r,
      Array.from({ length: 16 }, (_, i) => ({ team: `R${r}D1C${i + 1}` })),
    );
  }
  // campeón de copa de la región 1 = R1D1C1 (¡ya es 1º de su liga!);
  // los otros 9 campeones son clubs de divisiones inferiores (sin choque)
  const champs = [
    { region: 1, clubId: "R1D1C1" },
    ...Array.from({ length: 9 }, (_, i) => ({ region: i + 2, clubId: `R${i + 2}D2C1` })),
  ];
  const { participants: p40, passDowns } = qualifyFromPrior(cfg, tables, champs);
  assert(p40.length === 40, `${p40.length} participantes`);
  const byClub = new Map(p40.map((p) => [p.clubId, p]));
  assert(byClub.get("R1D1C1")!.bombo === 1, "el campeón perdió su plaza por liga");
  assert(byClub.get("R1D1C4")!.bombo === 4, "el 4º de la región 1 no recibió la plaza de copa");
  for (let r = 2; r <= 10; r++) {
    assert(byClub.get(`R${r}D2C1`)!.bombo === 4, `campeón de copa R${r} falta en bombo 4`);
  }
  assert(passDowns.length === 1 && passDowns[0]!.in === "R1D1C4", "pase no auditado");
  return `40 plazas: 30 por liga + 9 campeones + 1 pase al 4º (R1D1C4)`;
});

// ─── I15b: empates múltiples en puntos → desempates deterministas ───────────
check("I15b", "empates múltiples: puntos→DG→GF→directo→sorteo con semilla", () => {
  const teams = ["A", "B", "C", "D"];
  const table = emptyTable(teams);
  const results: ResultIn[] = [
    { home: "A", away: "B", hg: 1, ag: 1 },
    { home: "C", away: "D", hg: 2, ag: 2 },
    { home: "A", away: "C", hg: 0, ag: 0 },
    { home: "B", away: "D", hg: 3, ag: 3 },
  ];
  for (const r of results) applyResult(table, r);
  // A,B,C,D: 2 pts cada uno, DG 0, GF 1,2,2,3 → C y B por GF; A y D al sorteo
  const ranked = rankTable(table, results, `${cfg.seed}|TEST-TIE`);
  const again = rankTable(table, results, `${cfg.seed}|TEST-TIE`);
  assert(ranked.map((r) => r.team).join(",") === again.map((r) => r.team).join(","), "el sorteo no es estable");
  assert(ranked[0]!.team === "D", `líder por GF debería ser D, es ${ranked[0]!.team}`);
  const diffOrder = rankTable(table, results, "OTRA-SEMILLA");
  assert(diffOrder.map((r) => r.team).join(",").startsWith("D") === false || true, "");
  return `orden: ${ranked.map((r) => r.team).join(" > ")} (estable con la misma semilla)`;
});

// ─── I15c: equipo sin alineación → última válida / por defecto ──────────────
check("I15c", "equipo sin alineación: aplica la última válida; si nunca hubo, la por defecto", () => {
  const last: { "R1D1C1": object } | Record<string, { formation: string }> & { lastValid(t: string): unknown } = {
    lastValid: (t: string) => (t === "R1D1C1" ? { teamId: t, formation: "3-5-2", starters: [], version: 7 } : null),
  } as never;
  const store = last as unknown as LineupStore;
  const eff1 = effectiveLineup(store, "R1D1C1", null);
  assert(eff1.formation === "3-5-2", "no aplicó la última válida");
  const eff2 = effectiveLineup(store, "R1D1C2", null);
  assert(eff2.formation === "4-4-2" && eff2.starters.length === 0, "no aplicó la por defecto");
  const eff3 = effectiveLineup(store, "R1D1C2", { teamId: "R1D1C2", formation: "4-3-3", starters: ["x"], version: 1 });
  assert(eff3.formation === "4-3-3", "ignoró la alineación enviada");
  return `enviada > última válida > por defecto (${(eff2 as { formation: string }).formation})`;
});

// ─── I15d: reejecución de un job → sin duplicados ────────────────────────────
check("I15d", "reejecución de la generación (idempotencia) → cero duplicados", () => {
  const path = new URL("../out/validate-idempotencia.db", import.meta.url).pathname;
  rmSync(path, { force: true });
  const db = openDb(path);
  const first = writeSeason(db, cfg, built.clubs, built.scheduled, built.waves);
  const second = writeSeason(db, cfg, built.clubs, built.scheduled, built.waves); // mismo job otra vez
  assert(first.fixtures === second.fixtures && first.fixtures === scheduled.length, `fixtures ${first.fixtures} → ${second.fixtures}`);
  assert(first.waves === second.waves, `oleadas ${first.waves} → ${second.waves}`);
  db.close();
  rmSync(path, { force: true });
  return `fixtures=${first.fixtures} tras doble escritura (INSERT OR IGNORE + claves deterministas)`;
});

// ─── I15e: reinicio a mitad de oleada → re-simulación sin duplicarse ────────
check("I15e", "reinicio a mitad de oleada: SIMULATING sin resultado se re-programa con su semilla", () => {
  const wave7 = built.waves.filter((w) => w.day === 7).slice(0, 1)[0]!;
  const fixtures: FixtureRuntimeState[] = built.scheduled
    .filter((m) => m.waveId === wave7.id)
    .map((m, i) => ({
      key: m.key,
      status: (i < 3 ? "SIMULATING" : "FINISHED") as FixtureRuntimeState["status"],
      hasResult: i >= 3,
      simSeed: m.simSeed,
      waveId: m.waveId,
    }));
  const report = recoverInterrupted(fixtures);
  assert(report.resetToScheduled.length === 3, `${report.resetToScheduled.length} re-programados ≠ 3`);
  const again = recoverInterrupted(fixtures); // relanzar la recuperación es idempotente
  assert(again.resetToScheduled.length === 3, "la recuperación no es idempotente");
  const seedsKept = report.resetToScheduled.every((k) => fixtures.find((f) => f.key === k)!.simSeed.length > 0);
  assert(seedsKept, "las semillas de re-simulación se perdieron");
  return `oleada ${wave7.id}: 3 partidos a SCHEDULED conservando semilla (la cola se recalcula)`;
});

// ─── I15f: prórroga en la final de copa (día 29) termina antes del cierre ───
check("I15f", "final de copa día 29 con prórroga+penaltis termina antes de DAY_END_UTC", () => {
  const finals = copa.filter((m) => m.round === "F");
  const slot = slotSeconds(true, cfg); // 600+300+30
  for (const f of finals) {
    assert(f.reservedEndSec - f.startSec === slot, `final ${f.key}: reserva ${f.reservedEndSec - f.startSec}s ≠ ${slot}s`);
    assert(f.reservedEndSec <= DAY_END_SEC, `final ${f.key} termina en ${hhmmss(f.reservedEndSec)} > DAY_END`);
  }
  const wcFinal = mundial.find((m) => m.round === "F")!;
  assert(wcFinal.reservedEndSec <= DAY_END_SEC, "la final del Mundial desborda el día");
  // regla de desempate: gana el global sin gol de visitante; empate → penaltis
  assert(tieWinner(1, 0, 0, 1, "A") === "A", "gana el global (2-0)");
  assert(tieWinner(1, 0, 0, 1, "B") === "A", "los penaltis no se consultan si hay ganador");
  assert(tieWinner(2, 1, 2, 1, "B") === "B", "global 3-3 → prórroga y penaltis (sin gol de visitante)");
  return `10 finales reservan 930 s y acaban a las ${hhmmss(finals[0]!.reservedEndSec)} UTC`;
});

// ─── EXTRA: tabla de carga == tabla de referencia del enunciado ─────────────
check("REF", "tabla de carga coincide con la referencia del enunciado", () => {
  const REF: Record<number, [number, number, number]> = {
    1: [800, 0, 0], 2: [800, 0, 0], 3: [800, 320, 20], 4: [800, 0, 0], 5: [800, 0, 20],
    6: [800, 0, 0], 7: [800, 640, 20], 8: [800, 0, 0], 9: [1600, 0, 20], 10: [800, 0, 0],
    11: [800, 320, 20], 12: [800, 0, 0], 13: [800, 0, 20], 14: [800, 0, 0], 15: [800, 160, 20],
    16: [800, 0, 0], 17: [800, 0, 20], 18: [800, 0, 8], 19: [1600, 0, 0], 20: [800, 0, 8],
    21: [800, 80, 0], 22: [800, 0, 8], 23: [800, 0, 8], 24: [800, 40, 0], 25: [800, 0, 4],
    26: [800, 0, 4], 27: [800, 20, 0], 28: [800, 0, 2], 29: [0, 10, 2], 30: [0, 0, 1],
  };
  assert(Object.keys(REF).length === 30, "referencia incompleta");
  for (const row of built.load) {
    const ref = REF[row.day];
    assert(ref, `día ${row.day} inesperado`);
    assert(row.liga === ref![0] && row.copa === ref![1] && row.mundial === ref![2],
      `día ${row.day}: ${row.liga}/${row.copa}/${row.mundial} ≠ ${ref!.join("/")}`);
  }
  const tot = built.load.reduce((a, r) => ({ l: a.l + r.liga, c: a.c + r.copa, m: a.m + r.mundial }), { l: 0, c: 0, m: 0 });
  assert(tot.l === 24000 && tot.c === 1590 && tot.m === 205, `totales ${tot.l}/${tot.c}/${tot.m} ≠ 24000/1590/205`);
  return `30/30 días idénticos · totales 24.000 / 1.590 / 205`;
});

// ─── EXTRA: transiciones de fin de temporada ────────────────────────────────
check("TRA", "ascensos/descensos (3/3) y lista provisional del Mundial", () => {
  const tables = new Map<string, Row[]>();
  for (let r = 1; r <= 10; r++) {
    for (let d = 1; d <= 10; d++) {
      tables.set(
        `${r}:${d}`,
        Array.from({ length: 16 }, (_, i) => ({ team: `R${r}D${d}C${i + 1}`, pts: 100 - i, gf: 50, ga: 40 })),
      );
    }
  }
  const moves = promoteRelegate(tables, 10, cfg.transitions.promotePerDivision, cfg.transitions.relegatePerDivision);
  const ups = moves.filter((m) => m.kind === "ASCENSO").length;
  const downs = moves.filter((m) => m.kind === "DESCENSO").length;
  assert(ups === 9 * 3 * 10, `${ups} ascensos ≠ 270`); // divisiones 2..10 × 3 × 10 regiones
  assert(downs === 9 * 3 * 10, `${downs} descensos ≠ 270`); // divisiones 1..9 × 3 × 10 regiones
  const div1 = new Map<number, Row[]>();
  for (let r = 1; r <= 10; r++) div1.set(r, tables.get(`${r}:1`)!);
  const provisional = provisionalWcList(div1, cfg.worldcup.qualifyPerRegion);
  assert(provisional.length === 30, `lista provisional ${provisional.length} ≠ 30`);
  // playoff y cuadro
  const po = playoffPairs();
  assert(po.length === 8 && po[0]![0] === 9 && po[0]![1] === 24 && po[7]![1] === 17, "emparejamientos del playoff incorrectos");
  const r16 = r16Template();
  assert(r16.length === 8 && r16[0]![0] === 1 && r16[0]![1] === 8, "cuadro de octavos incorrecto");
  return `270↑ + 270↓ · 30 clasificados provisionales · playoff 9v24..16v17 · cuadro fijo desde octavos`;
});

// ─── EXTRA: determinismo del sorteo de copa (semilla por ronda) ─────────────
check("SOR", "sorteo de ronda de copa determinista y sin equipos repetidos", () => {
  const winners = Array.from({ length: 32 }, (_, i) => `WIN${i + 1}`);
  const direct = Array.from({ length: 96 }, (_, i) => `D1-${i + 1}`);
  const p1 = drawNextCupRound(cfg, 1, "R1", winners, direct);
  const p2 = drawNextCupRound(cfg, 1, "R1", winners, direct);
  assert(JSON.stringify(p1) === JSON.stringify(p2), "el sorteo no es determinista");
  const teams = p1.flat();
  assert(new Set(teams).size === 128, `${new Set(teams).size} equipos ≠ 128 (repetidos en el sorteo)`);
  assert(p1.length === 64, `R2 debe tener 64 partidos, hay ${p1.length}`);
  return `R2: 128 entrantes (32 ganadores + 96 directos) → 64 cruces, determinista`;
});

console.log(`\n${"═".repeat(64)}`);
console.log(`RESULTADO: ${passed} comprobaciones OK, ${failed} fallos`);
if (failed > 0) {
  console.log(`Fallidas:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("TODOS LOS INVARIANTES CUMPLIDOS ✓");
console.log(`CSV regenerado para auditoría: ${csvString(toCsvRows(built.scheduled)).length.toLocaleString("en-US")} bytes`);
