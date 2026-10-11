// Knight FM — TRAMA: Tejido de Reacciones, Azar y Momentos Adaptativos (Task 101).
// Implementation of the user-provided spec "Parte 3 · Motor de partido TRAMA".
//
// Core idea (spec 3.1): a match is not a chain of dice-rolled plays but a fabric
// of five threads (Mundo, Cuerpo, Mente, Juego, Azar) whose tensions cross at
// "knots" (nudos). Unpredictability is born from real causes and is explainable
// after the match. Deterministic from seed + state; symmetric rules; bounded chaos.
//
// FAITHFUL adaptations of the spec:
//   3.3  Knot: RE = Calidad × Fcuerpo × Fmente × Fmundo × Frol × Fsinergia × Fexp,
//        M = (RE_atk − RE_def) + Espacio + Táctica, P = 1/(1+e^(−M/T)),
//        T = T0 × (1 + Caos de contexto), T0 = 3, chaos 0..1.5 with the exact
//        source table (clima +0.35, terreno +0.30, fatiga +0.25, presión +0.20,
//        nervios +0.20×(1−Serenidad), afición +0.10, árbitro +0.10).
//   3.3  Graduated bands: Excelente/Correcto/Forzado/Fallo/Error/Desastre with
//        heavy tails scaled by Colas = 1.35 − 0.50 × Madurez (3.15).
//   3.5  Body: energy deposits with the non-linear curve (>70% free, 70-40
//        gradual, <40 strong, <15 cramp risk); injury risk
//        R = R0 × FatigaLocal^1.5 × Terreno × Frío × (1 − Protección médica).
//   3.6  Mind: mood reacting to goals, post-goal lapses, concentration dips.
//   3.8  Game: phases/doors (construcción→progresión→creación→finalización),
//        marea del partido (−1..1, inertia 0.93, saturation), lectura adaptativa
//        (repeated attack routes lose effectiveness), score management.
//   3.9  Unpredictability factory: variable luck temperature, hidden player day
//        (±10% heavy tails), black swans gated by a chaos budget (default 4),
//        reaction chains, emotional contagion.
//   3.11 Fairness: home advantage = sum of REAL factors (no travel + crowd +
//        pitch knowledge), CAPPED (default +3% effective performance), symmetric.
//   3.13 Calibration targets: constants below are tuned by
//        scripts/calibrate-trama.mjs against the spec's reference table.
//   3.15 Experience: Madurez = 1/(1+e^(−(edad−22)/3)); Bagaje = 100×(1−e^(−PE/200));
//        ExpEfectiva = 0.3×Madurez + 0.7×Bagaje/100;
//        Fexp = 1 + PesoNudo × (ExpEfectiva − Exigencia) clamp [0.85, 1.04];
//        Colas = 1.35 − 0.50 × Madurez; Serenidad = 0.5×Madurez + 0.5×bagaje.
//
// DOCUMENTED simplifications (aggregate teams, zero schema changes):
//   - Pulses of 2s → possession CHAINS (~2 per minute); each chain runs the four
//     phase doors as knots. Resolution is per-chain, not per-2s-pulse.
//   - 24×16 pitch cells → 3 zones (defense/midfield/attack) with wear + mud.
//   - Per-pair synergy network → team-level synergy factor (roadmap phase 2).
//   - PE is not stored in DB → deterministic career proxy PE_est = (edad−17)×26
//     feeding the spec's exact Bagaje formula (phase 2 will add a real counter).

import { mulberry32, seedFromString, TeamStrengthInput } from "@/lib/engine/kmie";
import type { MatchConditions } from "@/lib/engine/conditions";

// ─── Types ────────────────────────────────────────────────────────────────

export type Band = "EXCELENTE" | "CORRECTO" | "FORZADO" | "FALLO" | "ERROR" | "DESASTRE";
export type AttackRoute = "SHORT" | "WING" | "LONG";

export interface TramaTeamInput {
  strength: TeamStrengthInput;
  ages: number[]; // XI ages (Madurez per player)
  fatigueAvg: number; // pre-match fatigue 0..100 (DB)
  moraleConf: number; // avg (morale+confidence)/2 0..100
  youthCount: number; // U21 players in the XI
  stadiumLevel: number; // 1..5 (crowd + pitch knowledge, home side)
}

export interface GoalRecord { minute: number; band: Band; causes: string; penalty: boolean }
export interface CardRecord { side: "home" | "away"; minute: number; kind: "YELLOW" | "RED_STRAIGHT" | "RED_SECOND" }
export interface PenaltyRecord { side: "home" | "away"; minute: number; scored: boolean }
export interface InjuryRecord { side: "home" | "away"; minute: number; severity: "KNOCK" | "MUSCLE" }
export interface SwanRecord { minute: number; type: string }

export interface TramaResult {
  homeGoals: number;
  awayGoals: number;
  possessionHome: number;
  shotsHome: number;
  shotsAway: number;
  sotHome: number;
  sotAway: number;
  cornersHome: number;
  cornersAway: number;
  fouls: number;
  xgHomeX100: number;
  xgAwayX100: number;
  goalsHome: GoalRecord[];
  goalsAway: GoalRecord[];
  cards: CardRecord[];
  penalties: PenaltyRecord[];
  injuries: InjuryRecord[];
  swans: SwanRecord[];
  chaosUsed: number;
  fatigueDeltaHome: number; // extra match fatigue 4..15 (added to DB fatigue in matches.ts)
  fatigueDeltaAway: number;
  moodHome: number; // end-of-match mood −5..+5 (merged into morale in matches.ts)
  moodAway: number;
  tideFinal: number;
}

export interface TramaContext {
  competition: string; // LEAGUE | REGIONAL_CUP | WORLD_CHAMPIONSHIP | FRIENDLY
  stage?: string | null; // "F" for finals
  isFriendly?: boolean;
}

// ─── Spec constants ───────────────────────────────────────────────────────

const T0 = 3; // spec 3.3: base luck temperature
const CHAOS_MAX = 1.5; // spec 3.3: chaos range 0..1.5
const RE_F_MIN = 0.6;
const RE_F_MAX = 1.15;
const CHAOS_SOURCES = {
  climate: 0.35,
  pitch: 0.3,
  fatigue: 0.25,
  pressure: 0.2,
  nerves: 0.2,
  crowd: 0.1,
  referee: 0.1,
} as const;

// Experience module (3.15) — knot weights (exact) and situation exigency (exact).
const KNOT_WEIGHT: Record<string, number> = {
  DECISION: 0.2,
  POSITIONING: 0.2,
  SETPIECE: 0.2,
  TECHNIQUE: 0.15,
  DUEL: 0.04,
  SPRINT: 0,
};
function exigencyOf(ctx: TramaContext): number {
  if (ctx.isFriendly || ctx.competition === "FRIENDLY") return 0.15;
  if (ctx.competition === "LEAGUE") return 0.35;
  if (ctx.stage === "F") return 0.75; // final
  if (ctx.competition === "REGIONAL_CUP" || ctx.competition === "WORLD_CHAMPIONSHIP") return 0.6; // eliminatoria
  return 0.35;
}

// Style matchup (3.8 adapted): in-possession style vs out-of-possession style.
// Balanced by design (dominance < 58% per 3.13).
const STYLE_MATCHUP: Record<string, Record<string, number>> = {
  possession: { "mid-block": 0.25, "high-press": 0.1, "low-block": -0.25 },
  direct: { "low-block": 0.25, "mid-block": 0.05, "high-press": -0.1 },
  counter: { "high-press": 0.3, "mid-block": 0.0, "low-block": -0.3 },
  balanced: { "mid-block": 0.05, "high-press": -0.05, "low-block": -0.05 },
};

// Tuned constants (calibrated by scripts/calibrate-trama.mjs against 3.13).
// Quality scale: engine OVR (0-99) → spec "Calidad" (÷5, ≈1-20 per the spec's
// worked examples). Margins then live in the T0=3 temperature range.
const CHAINS_PER_MINUTE = 2.0;
const DOOR_BASE: [number, number, number] = [0.55, 0.2, 0.0];
const SHOT_FROM_FINISHING = 0.72;
const FINISH_DIFFICULTY = -9.4; // scoring is hard: shot knot lumps save/miss/off-target
const XG_SCALE = 0.85;
const FOUL_P = 0.125;
const YELLOW_P = 0.145;
const SECOND_YELLOW_TEAM_GATE = 4;
const SECOND_YELLOW_P = 0.18;
const STRAIGHT_RED_P = 0.003;
const PENALTY_P = 0.011; // of all fouls (box fouls only)
const PEN_CONVERT_P = 0.76;
const FOUL_KILLS_CHAIN_P = 0.7;
const INJURY_R0 = 0.01;
const HALFTIME_REPAIR = 0.15; // 10-20% per spec

// ─── Small math helpers ──────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const logistic = (m: number, t: number) => 1 / (1 + Math.exp(-m / t));

/** Spec 3.3 step 1: every factor F lives in [0.60, 1.15] with non-linear curves. */
const fBand = (v: number) => clamp(v, RE_F_MIN, RE_F_MAX);

/** Spec 3.15: Madurez = 1 / (1 + e^(−(edad−22)/3)). */
export function madurez(age: number): number {
  return 1 / (1 + Math.exp(-(age - 22) / 3));
}

/** Spec 3.15: Bagaje = 100 × (1 − e^(−PE/200)); PE proxy from career length. */
export function bagajeFromAge(age: number): number {
  const pe = Math.max(0, age - 17) * 26;
  return 100 * (1 - Math.exp(-pe / 200));
}

/** Spec 3.15: ExpEfectiva = 0.3 × Madurez + 0.7 × Bagaje/100. */
export function expEfectiva(age: number): number {
  return 0.3 * madurez(age) + 0.7 * (bagajeFromAge(age) / 100);
}

/** Spec 3.15: Fexp = 1 + PesoNudo × (ExpEfectiva − Exigencia), clamp [0.85, 1.04]. */
function fexp(ageAvg: number, knotKind: string, exigency: number): number {
  const w = KNOT_WEIGHT[knotKind] ?? 0.15;
  return clamp(1 + w * (expEfectiva(ageAvg) - exigency), 0.85, 1.04);
}

/** Spec 3.15: Colas = 1.35 − 0.50 × Madurez. */
function colasOf(ageAvg: number): number {
  return 1.35 - 0.5 * madurez(ageAvg);
}

/** Spec 3.5: non-linear energy curve. */
function bodyCurve(energyPct: number): number {
  const e = clamp(energyPct, 0, 100);
  if (e > 70) return 1;
  if (e > 40) return 0.88 + ((e - 40) / 30) * 0.12;
  if (e > 15) return 0.62 + ((e - 15) / 25) * 0.26;
  return 0.45 + (e / 15) * 0.17;
}

function avgAgeOf(ages: number[]): number {
  return ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 25;
}

// ─── World thread state ──────────────────────────────────────────────────

interface WorldState {
  rainIntensity: number;
  windKmh: number;
  tempC: number;
  zoneWear: [number, number, number];
  zoneMud: [number, number, number];
  crowdLevel: number;
  refereeSeverity: number;
  refereeConsistency: number;
}

function initWorld(cond: MatchConditions, homeStadium: number, rng: () => number): WorldState {
  const rain = cond.weather === "RAIN" ? 0.5 : cond.weather === "STORM" ? 0.9 : cond.weather === "SNOW" ? 0.4 : 0;
  const wearSeed = homeStadium <= 2 ? 0.35 : homeStadium === 3 ? 0.22 : 0.12;
  return {
    rainIntensity: rain,
    windKmh: cond.windKmh,
    tempC: cond.tempC,
    zoneWear: [wearSeed, wearSeed * 1.25, wearSeed],
    zoneMud: [0, 0, 0],
    crowdLevel: clamp(homeStadium / 5, 0, 1),
    refereeSeverity: clamp(cond.cardMul, 0.6, 1.6),
    refereeConsistency: 0.7 + rng() * 0.3,
  };
}

/** Spec 3.4: fronts with probability — weather evolves during the match. */
function evolveWeather(w: WorldState, rng: () => number): void {
  if (rng() < 0.3) w.rainIntensity = clamp(w.rainIntensity + (rng() - 0.45) * 0.5, 0, 1);
  if (rng() < 0.25) w.windKmh = clamp(w.windKmh + (rng() - 0.5) * 16, 0, 75);
}

/** Wear accumulates with play; rain converts it to mud (spec 3.4). */
function evolvePitch(w: WorldState, intensity: number): void {
  for (let z = 0; z < 3; z++) {
    w.zoneWear[z] = clamp(w.zoneWear[z] + intensity * (z === 1 ? 0.0016 : 0.001), 0, 1);
    w.zoneMud[z] = clamp(w.zoneWear[z] * w.rainIntensity, 0, 1);
  }
}

// ─── Team thread state ───────────────────────────────────────────────────

interface TeamState {
  side: "home" | "away";
  quality: { att: number; mid: number; def: number; gk: number };
  styleIn: string;
  styleOut: string;
  attackFactor: number;
  defenseFactor: number;
  possessionBias: number;
  energy: { aerobic: number; anaerobic: number; mental: number };
  mood: number;
  concentration: number;
  ages: number[];
  madurezAvg: number;
  colasMul: number;
  serenity: number;
  moraleConf: number;
  youthCount: number;
  yellowCount: number;
  dayForm: number;
  redCardDeficit: number; // each red ×0.93 on defense quality (bounded)
}

function initTeam(side: "home" | "away", input: TramaTeamInput, dayForm: number): TeamState {
  const s = input.strength;
  const ages = input.ages.length ? input.ages : [25, 25, 25, 25, 25, 25, 25, 25, 25, 25, 25];
  const madurezAvg = ages.reduce((a, b) => a + madurez(b), 0) / ages.length;
  const ageAvg = avgAgeOf(ages);
  const fresh = 100 - input.fatigueAvg;
  return {
    side,
    // Spec quality scale: OVR ÷5 (0-99 → ≈1-20) so knot margins match T0=3.
    quality: { att: s.attackOvr / 5, mid: s.midfieldOvr / 5, def: s.defenseOvr / 5, gk: s.gkOvr / 5 },
    styleIn: styleLabel(s.attackFactor ?? 1, s.possessionBias ?? 0),
    styleOut: outLabel(s.defenseFactor ?? 1),
    attackFactor: s.attackFactor ?? 1,
    defenseFactor: s.defenseFactor ?? 1,
    possessionBias: s.possessionBias ?? 0,
    energy: {
      aerobic: clamp(fresh * 0.9 + 10, 20, 100),
      anaerobic: clamp(fresh * 0.95 + 5, 20, 100),
      mental: clamp(fresh * 0.6 + input.moraleConf * 0.4, 20, 100),
    },
    mood: 0,
    concentration: clamp(input.moraleConf, 30, 95),
    ages,
    madurezAvg,
    colasMul: colasOf(ageAvg),
    serenity: clamp(0.5 * madurezAvg + 0.5 * (bagajeFromAge(ageAvg) / 100), 0, 1),
    moraleConf: input.moraleConf,
    youthCount: input.youthCount,
    yellowCount: 0,
    dayForm,
    redCardDeficit: 1,
  };
}

// style label helpers (map engine factors back to style labels for matchup table)
function styleLabel(attackFactor: number, possBias: number): string {
  if (possBias >= 3) return "possession";
  if (possBias <= -4) return "direct";
  if (possBias <= -2) return "counter";
  return "balanced";
}
function outLabel(defenseFactor: number): string {
  if (defenseFactor >= 1.045) return "low-block";
  if (defenseFactor >= 1.025) return "high-press";
  return "mid-block";
}

// ─── Chaos de contexto (spec 3.3 table, exact contributions) ─────────────

function chaosOf(
  world: WorldState,
  zone: 0 | 1 | 2,
  atk: TeamState,
  def: TeamState,
  pressure: number,
  crowdHostility: number
): { chaos: number; causes: string[] } {
  const climate = clamp(
    (world.rainIntensity > 0.6 ? 0.35 : world.rainIntensity > 0 ? 0.2 : 0) +
      (world.windKmh > 40 ? 0.15 : world.windKmh > 25 ? 0.07 : 0) +
      (world.tempC > 32 ? 0.12 : world.tempC < 0 ? 0.1 : 0),
    0,
    CHAOS_SOURCES.climate
  );
  const pitch = clamp((world.zoneMud[zone] > 0.3 ? 0.3 : world.zoneMud[zone] * 0.6) + (world.zoneWear[zone] > 0.6 ? 0.1 : 0), 0, CHAOS_SOURCES.pitch);
  const fatigueMix = ((1 - bodyCurve(atk.energy.aerobic)) + (1 - bodyCurve(def.energy.aerobic))) / 2;
  const fatigue = clamp(fatigueMix * 1.6, 0, 1) * CHAOS_SOURCES.fatigue;
  const press = pressure * CHAOS_SOURCES.pressure;
  const nerves = ((1 - atk.serenity) + (1 - def.serenity)) / 2 * CHAOS_SOURCES.nerves;
  const fans = crowdHostility * CHAOS_SOURCES.crowd;
  const ref = (1 - world.refereeConsistency) * CHAOS_SOURCES.referee;
  const chaos = clamp(climate + pitch + fatigue + press + nerves + fans + ref, 0, CHAOS_MAX);
  const causes: string[] = [];
  if (climate > 0.05) causes.push(`CLIMA +${climate.toFixed(2)}`);
  if (pitch > 0.05) causes.push(`TERRENO +${pitch.toFixed(2)}`);
  if (fatigue > 0.04) causes.push(`FATIGA +${fatigue.toFixed(2)}`);
  if (press > 0.04) causes.push(`PRESIÓN +${press.toFixed(2)}`);
  if (nerves > 0.05) causes.push(`NERVIOS +${nerves.toFixed(2)}`);
  return { chaos, causes };
}

// ─── Knot resolution (spec 3.3) ──────────────────────────────────────────

interface KnotArgs {
  rng: () => number;
  world: WorldState;
  zone: 0 | 1 | 2;
  atk: TeamState;
  def: TeamState;
  atkQuality: number;
  defQuality: number;
  knotKind: string;
  espacio: number;
  tactica: number;
  exigency: number;
  pressure: number;
  crowdHostility: number;
  tideForAtk: number;
  homeAdv: number; // applied to the home side's RE only (spec 3.11, capped)
  gameAtk: number; // score management (3.8): leading 0.96 / losing 1.03 / level 1
  gameDef: number; // leading 1.05 (park the bus) / losing 0.98 (risk taken)
}

interface KnotResult {
  success: boolean;
  band: Band;
  p: number;
  causes: string[];
}

function resolveKnot(a: KnotArgs): KnotResult {
  const { rng, world, zone, atk, def, atkQuality, defQuality, knotKind, espacio, tactica, exigency, pressure, crowdHostility, tideForAtk, homeAdv, gameAtk, gameDef } = a;

  const worldFactor = fBand(1 - world.zoneMud[zone] * 0.22 - world.zoneWear[zone] * 0.12);
  const mindFactor = (t: TeamState) => fBand(0.9 + (t.moraleConf / 100) * 0.15 + (t.mood / 100) * 0.4 + (t.concentration / 100 - 0.7) * 0.2);
  const bodyFactor = (t: TeamState) => fBand(0.35 + bodyCurve(t.energy.aerobic) * 0.4 + bodyCurve(t.energy.anaerobic) * 0.25);
  const roleFactor = (t: TeamState, isAtk: boolean) => {
    const complexity = isAtk && knotKind === "TECHNIQUE" ? 7 : 5;
    const capacity = 0.5 * clamp(t.quality.mid / 2, 1, 10) + 0.3 * expEfectiva(avgAgeOf(t.ages)) * 10 + 0.2 * t.madurezAvg * 10;
    const deficit = Math.max(0, complexity - clamp(capacity, 1, 10));
    return fBand(1 - Math.min(0.12, deficit * 0.03));
  };
  const synFactor = (t: TeamState, tide: number) => fBand(0.96 + tide * 0.06 + t.mood / 500);
  const ageAvgA = avgAgeOf(atk.ages);
  const ageAvgD = avgAgeOf(def.ages);

  const boostAtk = atk.side === "home" ? 1 + homeAdv / 2 : 1; // 3.11: cap is the MATCH average, knots share it
  const boostDef = def.side === "home" ? 1 + homeAdv / 2 : 1;
  const reAtk =
    atkQuality * bodyFactor(atk) * mindFactor(atk) * worldFactor * roleFactor(atk, true) * synFactor(atk, tideForAtk) * fexp(ageAvgA, knotKind, exigency) * atk.dayForm * atk.attackFactor * gameAtk * boostAtk;
  const reDef =
    defQuality * bodyFactor(def) * mindFactor(def) * worldFactor * roleFactor(def, false) * synFactor(def, -tideForAtk) * fexp(ageAvgD, knotKind, exigency) * def.dayForm * def.defenseFactor * def.redCardDeficit * gameDef * boostDef;

  const margin = reAtk - reDef + espacio + tactica + tideForAtk * 0.3;
  const { chaos, causes } = chaosOf(world, zone, atk, def, pressure, crowdHostility);
  const t = T0 * (1 + chaos);
  const p = logistic(margin, t);

  const u = rng();
  const success = u < p;
  const heavy = Math.pow(rng(), atk.colasMul); // heavy tail (3.3 step 4 + 3.15 Colas)
  let band: Band;
  if (success) {
    band = heavy < 0.2 ? "EXCELENTE" : heavy < 0.72 ? "CORRECTO" : "FORZADO";
  } else {
    band = heavy < 0.6 ? "FALLO" : heavy < 0.94 ? "ERROR" : "DESASTRE";
  }
  return { success, band, p, causes };
}

// ─── Match loop ──────────────────────────────────────────────────────────

export function runTramaMatch(
  seedStr: string,
  home: TramaTeamInput,
  away: TramaTeamInput,
  cond: MatchConditions,
  ctx: TramaContext,
  opts: { chaosBudget: number; blackSwanPerMil: number; homeAdvCapPct: number }
): TramaResult {
  const exigency = exigencyOf(ctx);
  const rngW = mulberry32(seedFromString(`TRAMA:W:${seedStr}`));
  const rngM = mulberry32(seedFromString(`TRAMA:M:${seedStr}`));
  const rngS = mulberry32(seedFromString(`TRAMA:S:${seedStr}`));

  const world = initWorld(cond, home.stadiumLevel, rngW);

  // Hidden player day (3.9): ±8% heavy tails, 15% incidence, symmetric, never shown.
  const dayMul = (): number => 1 + (rngS() < 0.15 ? (rngS() < 0.5 ? 1 : -1) * Math.pow(rngS(), 1.5) * 0.08 : 0);
  const H = initTeam("home", home, dayMul());
  const A = initTeam("away", away, dayMul());

  // Fairness (3.11): home advantage = real factors (no travel 1.2% + crowd up to 1.8%), capped.
  const homeAdv = Math.min(opts.homeAdvCapPct, 1.2 + world.crowdLevel * 1.8) / 100;

  let tide = 0;
  let chaosUsed = 0;
  const res: TramaResult = {
    homeGoals: 0, awayGoals: 0, possessionHome: 50, shotsHome: 0, shotsAway: 0,
    sotHome: 0, sotAway: 0, cornersHome: 0, cornersAway: 0, fouls: 0,
    xgHomeX100: 0, xgAwayX100: 0, goalsHome: [], goalsAway: [], cards: [],
    penalties: [], injuries: [], swans: [], chaosUsed: 0,
    fatigueDeltaHome: 0, fatigueDeltaAway: 0, moodHome: 0, moodAway: 0, tideFinal: 0,
  };

  const routeUsage = { home: { SHORT: 0, WING: 0, LONG: 0 }, away: { SHORT: 0, WING: 0, LONG: 0 } };
  // Spec 3.8 lectura adaptativa: repeated routes lose up to −12% effectiveness
  // (as knot-margin points: −0.12 × progress, capped −0.5).
  const routeLectura = (side: "home" | "away", route: AttackRoute): number => {
    return -0.12 * clamp(routeUsage[side][route] / 55, 0, 1) * 4.2;
  };
  const pickRoute = (t: TeamState, rng: () => number): AttackRoute => {
    const bias: AttackRoute[] =
      t.styleIn === "direct" ? ["LONG", "WING", "SHORT"]
      : t.styleIn === "possession" ? ["SHORT", "SHORT", "WING", "LONG"]
      : t.styleIn === "counter" ? ["WING", "LONG", "SHORT"]
      : ["SHORT", "WING", "LONG", "SHORT"];
    return bias[Math.floor(rng() * bias.length)] ?? "SHORT";
  };

  const addedMinutes = 1 + Math.floor(rngS() * 4);
  const totalMinutes = 90 + addedMinutes;
  let chainHome = 0;
  let chainAway = 0;
  let lapseHome = 0;
  let lapseAway = 0;

  for (let minute = 1; minute <= totalMinutes; minute++) {
    if (minute === 46) {
      // Halftime: groundstaff repairs 10-20% of wear (3.4); rest restores energy/mind.
      for (let z = 0; z < 3; z++) world.zoneWear[z] *= 1 - HALFTIME_REPAIR;
      for (const t of [H, A]) {
        t.energy.anaerobic = clamp(t.energy.anaerobic + 30, 0, 100);
        t.energy.mental = clamp(t.energy.mental + 15, 0, 100);
      }
    }

    // ── Mundo ──
    evolveWeather(world, rngW);
    evolvePitch(world, 0.5 + Math.abs(tide) * 0.5);

    // ── Cisnes negros (3.9): rare, budget-gated, bounded effect ──
    if (rngS() * 1000 < opts.blackSwanPerMil && chaosUsed < opts.chaosBudget) {
      const type = ["FOCUS_FAILURE", "OBJECT_THROWN", "INVASION_THREAT"][Math.floor(rngS() * 3)];
      res.swans.push({ minute, type });
      chaosUsed++;
      tide = clamp(tide + (rngS() < 0.5 ? 0.08 : -0.08), -1, 1);
      world.refereeConsistency = clamp(world.refereeConsistency - 0.05, 0.6, 1);
    }

    // ── Cuerpo (3.5): consumption + recovery per minute ──
    for (const t of [H, A]) {
      const heat = world.tempC > 30 ? 1.35 : world.tempC > 26 ? 1.15 : 1;
      const mudCost = 1 + (world.zoneMud[1] > 0.3 ? 0.15 : 0);
      t.energy.aerobic = clamp(t.energy.aerobic - 0.55 * heat * mudCost + 0.18, 0, 100);
      t.energy.anaerobic = clamp(t.energy.anaerobic - 0.7 * heat + 1.4, 0, 100);
      t.energy.mental = clamp(t.energy.mental - 0.25, 0, 100);
      if (t.energy.anaerobic < 15 && rngM() < 0.01) t.mood = clamp(t.mood - 1, -10, 10); // cramp window
    }

    // ── Mente (3.6): concentration + post-goal lapses ──
    H.concentration = clamp(H.concentration + (lapseHome > 0 ? -0.8 : 0.5), 20, 100);
    A.concentration = clamp(A.concentration + (lapseAway > 0 ? -0.8 : 0.5), 20, 100);
    if (lapseHome > 0) lapseHome--;
    if (lapseAway > 0) lapseAway--;

    // ── Juego: possession chains (doors are knots) ──
    const midHome = H.quality.mid * (1 + H.possessionBias / 100);
    const midAway = A.quality.mid * (1 + A.possessionBias / 100);
    const ratio = midHome / Math.max(midHome + midAway, 1);
    const pHomePoss = clamp(0.5 + (ratio - 0.5) * 1.6 + tide * 0.05, 0.2, 0.8);
    // Gestión del marcador (3.8): the leader manages (attack down, defense up),
    // the loser takes risks (attack up, defense slightly down). Progressive by
    // margin; late equal matches settle (both manage). Personalities would
    // modulate this (roadmap phase 2).
    const diff = res.homeGoals - res.awayGoals;
    const adiff = Math.abs(diff);
    const leadAtk = adiff >= 3 ? 0.88 : adiff === 2 ? 0.93 : 0.96;
    const leadDef = adiff >= 3 ? 1.08 : adiff === 2 ? 1.06 : 1.05;
    const lateLevel = minute > 70 ? 0.98 : 1;
    const gameH = { atk: diff > 0 ? leadAtk : diff < 0 ? 1.03 : lateLevel, def: diff > 0 ? leadDef : diff < 0 ? 0.98 : 1 };
    const gameA = { atk: diff < 0 ? leadAtk : diff > 0 ? 1.03 : lateLevel, def: diff < 0 ? leadDef : diff > 0 ? 0.98 : 1 };
    const chainsThisMinute = rngM() < CHAINS_PER_MINUTE - 1 ? 2 : 1;

    for (let c = 0; c < chainsThisMinute; c++) {
      const atk = rngM() < pHomePoss ? H : A;
      const def = atk === H ? A : H;
      const side: "home" | "away" = atk === H ? "home" : "away";
      if (side === "home") chainHome++; else chainAway++;

      // ── Disciplina (3.8): fouls happen all over the pitch, on any chain ──
      const foul = rngM() < FOUL_P * (def.styleOut === "high-press" ? 1.25 : 1);
      let foulKilledChain = false;
      if (foul) {
        res.fouls++;
        const inBox = rngM() < PENALTY_P;
        if (inBox) {
          const scored = rngM() < PEN_CONVERT_P;
          res.penalties.push({ side, minute, scored });
          if (scored) {
            if (side === "home") {
              res.homeGoals++; res.sotHome++; res.xgHomeX100 += Math.round(PEN_CONVERT_P * 100);
              res.goalsHome.push({ minute, band: "CORRECTO", causes: "PENALTI", penalty: true });
            } else {
              res.awayGoals++; res.sotAway++; res.xgAwayX100 += Math.round(PEN_CONVERT_P * 100);
              res.goalsAway.push({ minute, band: "CORRECTO", causes: "PENALTI", penalty: true });
            }
            tide = clamp(tide + (side === "home" ? 0.25 : -0.25), -1, 1);
            atk.mood = clamp(atk.mood + 3, -10, 10); def.mood = clamp(def.mood - 3, -10, 10);
            if (side === "home") lapseAway = 3; else lapseHome = 3;
          } else {
            atk.mood = clamp(atk.mood - 2, -10, 10); // doubt after missing (3.6)
          }
        }
        const cardRoll = rngM();
        const yP = YELLOW_P * world.refereeSeverity * (1 + exigency * 0.5);
        if (cardRoll < STRAIGHT_RED_P * world.refereeSeverity) {
          res.cards.push({ side, minute, kind: "RED_STRAIGHT" });
          chaosUsed++;
          def.mood = clamp(def.mood - 4, -10, 10);
          def.redCardDeficit *= 0.93; // playing a man down (bounded)
          tide = clamp(tide + (side === "home" ? -0.15 : 0.15), -1, 1);
        } else if (cardRoll < yP) {
          def.yellowCount++;
          if (def.yellowCount > SECOND_YELLOW_TEAM_GATE && rngM() < SECOND_YELLOW_P) {
            res.cards.push({ side, minute, kind: "RED_SECOND" });
            def.mood = clamp(def.mood - 4, -10, 10);
            def.redCardDeficit *= 0.93;
          } else {
            res.cards.push({ side, minute, kind: "YELLOW" });
          }
        }
        // A free kick usually kills the attack (unless it produced a penalty).
        foulKilledChain = !inBox && rngM() < FOUL_KILLS_CHAIN_P;
        if (foulKilledChain) continue;
      }

      const route = pickRoute(atk, rngM);
      routeUsage[side][route] += 1;
      const tactica = STYLE_MATCHUP[atk.styleIn]?.[def.styleOut] ?? 0;
      const pressure = exigency;
      const hostility = side === "home" ? 0 : world.crowdLevel; // away team faces the crowd
      const tideForAtk = side === "home" ? tide : -tide;
      const gameAtk = side === "home" ? gameH.atk : gameA.atk;
      const gameDef = side === "home" ? gameA.def : gameH.def;

      // Door 1 — construction (defensive third)
      const k1 = resolveKnot({
        rng: rngM, world, zone: 0, atk, def,
        atkQuality: atk.quality.def * 0.6 + atk.quality.mid * 0.4 + atk.quality.gk * 0.15,
        defQuality: def.quality.def * 0.7 + def.quality.mid * 0.3,
        knotKind: "DECISION",
        espacio: DOOR_BASE[0] + (atk.styleIn === "possession" ? 0.25 : 0),
        tactica: 0, exigency, pressure, crowdHostility: hostility, tideForAtk, homeAdv, gameAtk, gameDef,
      });
      if (!applyConsequences(k1, atk, def)) continue;
      spendEnergy(atk, 1);

      // Door 2 — progression (middle third), lectura bites here
      const k2 = resolveKnot({
        rng: rngM, world, zone: 1, atk, def,
        atkQuality: atk.quality.mid,
        defQuality: def.quality.mid * 0.7 + def.quality.def * 0.3,
        knotKind: "DECISION",
        espacio: DOOR_BASE[1] + routeLectura(side, route) + (atk.styleIn === "counter" && Math.abs(tide) > 0.4 ? 0.3 : 0),
        tactica, exigency, pressure, crowdHostility: hostility, tideForAtk, homeAdv, gameAtk, gameDef,
      });
      if (!applyConsequences(k2, atk, def)) continue;
      spendEnergy(atk, 1.4);

      // Door 3 — creation (attacking third)
      const k3 = resolveKnot({
        rng: rngM, world, zone: 2, atk, def,
        atkQuality: atk.quality.att * 0.7 + atk.quality.mid * 0.3,
        defQuality: def.quality.def,
        knotKind: "TECHNIQUE",
        espacio: DOOR_BASE[2] + routeLectura(side, route),
        tactica: 0, exigency, pressure, crowdHostility: hostility, tideForAtk, homeAdv, gameAtk, gameDef,
      });
      const created = applyConsequences(k3, atk, def);
      spendEnergy(atk, 1.6);
      if (!created) {
        if (k3.band === "FORZADO" && rngM() < 0.7) { if (side === "home") res.cornersHome++; else res.cornersAway++; }
        continue;
      }

      // Finishing knot — shot vs GK + defense
      if (rngM() > SHOT_FROM_FINISHING) continue; // recycled possession
      const gkDef = def.quality.gk * 0.55 + def.quality.def * 0.45 * def.redCardDeficit;
      const k4 = resolveKnot({
        rng: rngM, world, zone: 2, atk, def,
        atkQuality: atk.quality.att,
        defQuality: gkDef,
        knotKind: "TECHNIQUE",
        espacio: FINISH_DIFFICULTY + (route === "LONG" && world.windKmh > 35 ? -0.3 : 0),
        tactica: 0, exigency, pressure, crowdHostility: hostility, tideForAtk, homeAdv, gameAtk, gameDef,
      });
      spendEnergy(atk, 2.2);
      if (side === "home") { res.shotsHome++; res.xgHomeX100 += Math.round(k4.p * 100 * XG_SCALE); }
      else { res.shotsAway++; res.xgAwayX100 += Math.round(k4.p * 100 * XG_SCALE); }

      if (k4.success) {
        if (side === "home") {
          res.homeGoals++; res.sotHome++;
          res.goalsHome.push({ minute, band: k4.band, causes: k4.causes.join(" · "), penalty: false });
        } else {
          res.awayGoals++; res.sotAway++;
          res.goalsAway.push({ minute, band: k4.band, causes: k4.causes.join(" · "), penalty: false });
        }
        const swing = k4.band === "EXCELENTE" ? 0.4 : 0.3;
        tide = clamp(tide + (side === "home" ? swing : -swing), -1, 1);
        atk.mood = clamp(atk.mood + 4, -10, 10);
        def.mood = clamp(def.mood - 3, -10, 10);
        if (side === "home") lapseAway = 3; else lapseHome = 3;
        if (def.youthCount >= 3) def.concentration = clamp(def.concentration - 6, 20, 100);
      } else {
        // Saved / blocked / off target: rebounds and second balls (3.9).
        if (rngM() < 0.45) { if (side === "home") res.cornersHome++; else res.cornersAway++; }
        if (k4.p > 0.3 || rngM() < 0.25) { if (side === "home") res.sotHome++; else res.sotAway++; }
        if (k4.band === "DESASTRE" && chaosUsed < opts.chaosBudget) {
          chaosUsed++;
          tide = clamp(tide + (side === "home" ? 0.2 : -0.2), -1, 1);
        }
      }

      // ── Lesiones (3.5): R = R0 × Fatiga^1.5 × Terreno × Frío × (1 − Protección) ──
      const fatigueLocal = clamp((100 - atk.energy.anaerobic) / 100, 0, 1);
      const terrain = 1 + world.zoneMud[2] * 0.8 + world.zoneWear[2] * 0.3;
      const cold = world.tempC < 2 ? 1.25 : 1;
      const injuryP = INJURY_R0 * Math.pow(fatigueLocal, 1.5) * terrain * cold * (1 + exigency * 0.5);
      if (rngM() < injuryP) {
        res.injuries.push({ side, minute, severity: fatigueLocal > 0.6 ? "MUSCLE" : "KNOCK" });
      }
      void foulKilledChain;
    }

    tide = clamp(tide * 0.93, -1, 1); // inertia + saturation (3.8)
  }

  const totalChains = Math.max(1, chainHome + chainAway);
  res.possessionHome = Math.round(clamp((chainHome / totalChains) * 100, 25, 75));
  res.chaosUsed = chaosUsed;
  res.tideFinal = tide;
  res.fatigueDeltaHome = Math.round(clamp((100 - H.energy.aerobic) * 0.18, 4, 15));
  res.fatigueDeltaAway = Math.round(clamp((100 - A.energy.aerobic) * 0.18, 4, 15));
  res.moodHome = Math.round(clamp(H.mood / 2, -5, 5));
  res.moodAway = Math.round(clamp(A.mood / 2, -5, 5));
  return res;
}

// ─── Chain consequences (3.3 step 5) ─────────────────────────────────────

function applyConsequences(k: KnotResult, atk: TeamState, def: TeamState): boolean {
  if (k.success) {
    if (k.band === "EXCELENTE") {
      atk.mood = clamp(atk.mood + 0.6, -10, 10);
      def.mood = clamp(def.mood - 0.4, -10, 10);
    } else if (k.band === "FORZADO") {
      atk.energy.anaerobic = clamp(atk.energy.anaerobic - 2, 0, 100);
    }
    return true;
  }
  if (k.band === "ERROR" || k.band === "DESASTRE") {
    // turnover with consequence → reaction chain: defender gains momentum
    def.mood = clamp(def.mood + 0.5, -10, 10);
    atk.mood = clamp(atk.mood - 0.8, -10, 10);
  }
  return false;
}

function spendEnergy(t: TeamState, amount: number): void {
  t.energy.anaerobic = clamp(t.energy.anaerobic - amount * 1.2, 0, 100);
  t.energy.aerobic = clamp(t.energy.aerobic - amount * 0.4, 0, 100);
}
