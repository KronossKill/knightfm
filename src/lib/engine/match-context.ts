// Knight FM — KMIE v3 MATCH CONTEXT (mandato del usuario: "El motor del partido
// debe estar bien definido y las tarjetas identificar todas las características
// del próximo partido").
//
// Everything here is DETERMINISTIC from the fixture seed: the same weather,
// pitch and conditions shown on the pre-match card are the exact inputs the
// simulation consumes at kickoff. Nothing is invented and nothing changes after
// the fact — the preview can never contradict the acta.
//
// Seed contract:
//   match result stream : KMIE:<season>:<competition>:<fixtureId>   (kmie.ts)
//   events stream       : KMIE-EV:<fixtureId>                       (matches.ts)
//   context stream      : KMIE-CTX:<fixtureId>                      (this file)
//
// Effects are additive multipliers inside the λ (expected-goals) model of
// kmie.ts: weather affects BOTH teams; pitch reflects the HOME team's stadium.

import { mulberry32, seedFromString } from "./kmie";

// ─── Weather: 11 states ────────────────────────────────────────────
// lambdaMult  → multiplier on both teams' expected goals
// gkMult      → multiplier on the DEFENDING side's GK effectiveness
// possNoise   → extra percentage-point noise added to possession
// fatigueMult → multiplier applied to the fatigue penalty
export interface WeatherState {
  id: string;
  lambdaMult: number;
  gkMult: number;
  possNoise: number;
  fatigueMult: number;
  months?: number[]; // realistic seasonality (1=Jan … 12=Dec); undefined = any
  weight: number; // relative draw weight inside its season window
}

export const WEATHER_STATES: WeatherState[] = [
  { id: "CLEAR",      lambdaMult: 1.00, gkMult: 1.00, possNoise: 0,  fatigueMult: 1.00, weight: 16 },
  { id: "CLOUDY",     lambdaMult: 1.00, gkMult: 1.00, possNoise: 1,  fatigueMult: 1.00, weight: 16 },
  { id: "OVERCAST",   lambdaMult: 0.99, gkMult: 1.00, possNoise: 1,  fatigueMult: 1.00, weight: 12 },
  { id: "LIGHT_RAIN", lambdaMult: 0.97, gkMult: 0.99, possNoise: 2,  fatigueMult: 1.00, weight: 9 },
  { id: "HEAVY_RAIN", lambdaMult: 0.90, gkMult: 0.97, possNoise: 6,  fatigueMult: 1.02, weight: 5 },
  { id: "STORM",      lambdaMult: 0.82, gkMult: 0.95, possNoise: 10, fatigueMult: 1.04, weight: 2 },
  { id: "WINDY",      lambdaMult: 0.95, gkMult: 1.00, possNoise: 8,  fatigueMult: 1.01, weight: 6 },
  { id: "FOG",        lambdaMult: 0.93, gkMult: 0.99, possNoise: 4,  fatigueMult: 1.00, weight: 4, months: [10, 11, 12, 1, 2] },
  { id: "SNOW",       lambdaMult: 0.84, gkMult: 0.96, possNoise: 8,  fatigueMult: 1.05, weight: 4, months: [12, 1, 2] },
  { id: "HEAT",       lambdaMult: 0.96, gkMult: 1.00, possNoise: 2,  fatigueMult: 1.08, weight: 5, months: [6, 7, 8] },
  { id: "HUMID",      lambdaMult: 0.98, gkMult: 1.00, possNoise: 2,  fatigueMult: 1.04, weight: 4, months: [5, 6, 7, 8, 9] },
];

// ─── Pitch (HOME team's stadium): 8 states ─────────────────────────
export interface PitchState {
  id: string;
  lambdaMult: number;
  possNoise: number;
  weight: number;
  months?: number[];
}

export const PITCH_STATES: PitchState[] = [
  { id: "PRISTINE",   lambdaMult: 1.00, possNoise: 0,  weight: 10 },
  { id: "GOOD",       lambdaMult: 1.00, possNoise: 1,  weight: 14 },
  { id: "WORN",       lambdaMult: 0.99, possNoise: 3,  weight: 8 },
  { id: "WET",        lambdaMult: 0.94, possNoise: 4,  weight: 6, months: [9, 10, 11, 12, 1, 2, 3] },
  { id: "MUD",        lambdaMult: 0.88, possNoise: 8,  weight: 3, months: [10, 11, 12, 1, 2] },
  { id: "FROZEN",     lambdaMult: 0.86, possNoise: 6,  weight: 3, months: [12, 1, 2] },
  { id: "BUMPY",      lambdaMult: 0.93, possNoise: 5,  weight: 4 },
  { id: "ARTIFICIAL", lambdaMult: 1.02, possNoise: -2, weight: 3 },
];

export interface MatchContext {
  weather: WeatherState;
  pitch: PitchState;
  temperatureC: number;
  windKmh: number;
  humidityPct: number;
}

const WEIGHTED = (states: Array<{ id: string; weight: number; months?: number[] }>, month: number, r: number): { id: string; weight: number; months?: number[] } => {
  // Seasonality fallback: states restricted to other months are re-drawn from
  // the neutral pool (CLEAR/CLOUDY/OVERCAST/GOOD) so every month has a full deck.
  const eligible = states.filter((s) => !s.months || s.months.includes(month));
  const pool = eligible.length > 0 ? eligible : states.filter((s) => !s.months);
  const total = pool.reduce((a, s) => a + s.weight, 0);
  let acc = r * total;
  for (const s of pool) {
    acc -= s.weight;
    if (acc <= 0) return s;
  }
  return pool[pool.length - 1];
};

const byId = <T extends { id: string }>(list: T[], id: string): T => list.find((s) => s.id === id) as T;

/**
 * Deterministic context for a fixture. `seedStr` MUST be the fixture seed
 * ("KMIE:<season>:<competition>:<fixtureId>"); the context stream derives from
 * it with its own namespace, so preview and acta always agree.
 */
export function deriveMatchContext(seedStr: string, kickoffAt: Date): MatchContext {
  const rng = mulberry32(seedFromString(`${seedStr}:CTX`));
  const month = kickoffAt.getUTCMonth() + 1;

  const weather = byId(WEATHER_STATES, WEIGHTED(WEATHER_STATES, month, rng()).id);
  const pitch = byId(PITCH_STATES, WEIGHTED(PITCH_STATES, month, rng()).id);

  // Temperature anchored to the month + weather sanity clamps.
  const monthlyBaseC = [-2, 0, 4, 9, 14, 19, 22, 22, 17, 11, 5, 0][month - 1];
  let temperatureC = Math.round(monthlyBaseC + (rng() * 10 - 5));
  if (weather.id === "HEAT") temperatureC = Math.max(temperatureC, 32 + Math.floor(rng() * 8));
  if (weather.id === "SNOW") temperatureC = Math.min(temperatureC, 0 + Math.floor(rng() * 3));
  if (weather.id === "FROZEN" || pitch.id === "FROZEN") temperatureC = Math.min(temperatureC, 0);

  const windKmh = weather.id === "STORM" ? 55 + Math.floor(rng() * 30) : weather.id === "WINDY" ? 28 + Math.floor(rng() * 18) : 4 + Math.floor(rng() * 16);
  const humidityPct =
    weather.id === "STORM" || weather.id === "HEAVY_RAIN" ? 88 + Math.floor(rng() * 10) : weather.id === "HEAT" ? 30 + Math.floor(rng() * 20) : 45 + Math.floor(rng() * 35);

  return { weather, pitch, temperatureC, windKmh, humidityPct };
}

/** Aggregate effect of the context on the λ model (used by kmie + preview). */
export interface ContextEffects {
  lambdaMult: number; // weather × pitch
  gkMult: number; // defending GK effectiveness
  possNoise: number; // extra possession percentage-point noise
  fatigueMult: number;
}

export function contextEffects(ctx: MatchContext): ContextEffects {
  return {
    lambdaMult: ctx.weather.lambdaMult * ctx.pitch.lambdaMult,
    gkMult: ctx.weather.gkMult,
    possNoise: ctx.weather.possNoise + ctx.pitch.possNoise,
    fatigueMult: ctx.weather.fatigueMult,
  };
}

// ─── Analytical forecast (honest probabilities, not certainty) ─────

export function poissonPmf(lambda: number, k: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / fact;
}

export interface OutcomeForecast {
  homeWin: number; // 0..1
  draw: number;
  awayWin: number;
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  topScorelines: Array<{ h: number; a: number; p: number }>;
}

/**
 * Exact Poisson outcome grid (0..12 goals each side). This is the pre-match
 * forecast shown on the cards: a probabilistic model over the SAME λ that the
 * simulation samples — a forecast, never a promise.
 */
export function matchOutcomes(lambdaHome: number, lambdaAway: number): OutcomeForecast {
  const K = 12;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  const grid: Array<{ h: number; a: number; p: number }> = [];
  for (let h = 0; h <= K; h++) {
    for (let a = 0; a <= K; a++) {
      const p = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
      if (h > a) homeWin += p;
      else if (h === a) draw += p;
      else awayWin += p;
      grid.push({ h, a, p });
    }
  }
  const norm = homeWin + draw + awayWin;
  const topScorelines = grid.sort((x, y) => y.p - x.p).slice(0, 3).map((g) => ({ h: g.h, a: g.a, p: g.p / norm }));
  return {
    homeWin: homeWin / norm,
    draw: draw / norm,
    awayWin: awayWin / norm,
    expectedGoalsHome: lambdaHome,
    expectedGoalsAway: lambdaAway,
    topScorelines,
  };
}
