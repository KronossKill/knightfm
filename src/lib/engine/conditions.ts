// Knight FM — KMIE 2.0 match conditions (Task 100).
// Weather, pitch state, hidden day-form volatility and referee strictness —
// ALL derived deterministically from a per-fixture seed, so every match is
// reproducible from seed + state (same principle as kmie.ts: causal,
// probabilistic, no scripted results, no rubber-banding).
//
// Forensic note (Task 100 audit): these layers were NEVER present in any
// prior delivery (matches.ts 578 / kmie.ts 91 lines byte-identical across
// v8/v9 zips, git history and the full worklog). They close the gap between
// what docs/01-arquitectura.md promised (style, pressure, sports science)
// and what the engine actually applied. Zero schema changes: everything is
// derived from the fixture seed + existing Facility rows.

import { mulberry32, seedFromString } from "@/lib/engine/kmie";

export type WeatherType = "CLEAR" | "CLOUDY" | "RAIN" | "STORM" | "SNOW" | "WIND" | "HEAT";
export type PitchState = "EXCELLENT" | "GOOD" | "WORN" | "HEAVY";
export type RefereeMood = "LENIENT" | "NORMAL" | "STRICT";

export interface MatchConditions {
  weather: WeatherType;
  tempC: number;
  windKmh: number;
  pitch: PitchState;
  /** Goal-lambda multipliers (weather × pitch, home gets the "knows the field" edge on bad pitches). */
  homeGoalMul: number;
  awayGoalMul: number;
  /** Possession noise multiplier (wind/rain make the ball harder to keep). */
  possessionNoiseMul: number;
  /** Injury probability multiplier (weather × pitch only; medical/science applied per club in matches.ts). */
  injuryFactor: number;
  /** Card-draw multiplier (weather wetness × referee strictness). */
  cardMul: number;
  referee: RefereeMood;
  /** HIDDEN day-form multipliers (inspired / off-day) — deliberately not exposed in the report. */
  homeFormMul: number;
  awayFormMul: number;
}

export interface ConditionsInput {
  regionIndex: number; // Region.index 0..9 → climate band (0-2 cold, 3-6 temperate, 7-9 hot)
  homeStadiumLevel: number; // Facility STADIUM level 1..5
  weatherEnabled: boolean;
  pitchEnabled: boolean;
  dayFormPct: number; // 0..30 — chance each team has an inspired/off day
  refereeVariancePct: number; // 0..40 — card-draw variance around 1.0
}

const WEATHER_EFFECT: Record<WeatherType, { goal: number; possNoise: number; injury: number; wet: number }> = {
  CLEAR: { goal: 1.0, possNoise: 1.0, injury: 1.0, wet: 0.0 },
  CLOUDY: { goal: 0.99, possNoise: 1.0, injury: 1.0, wet: 0.0 },
  WIND: { goal: 0.94, possNoise: 1.6, injury: 1.05, wet: 0.5 },
  RAIN: { goal: 0.94, possNoise: 1.4, injury: 1.15, wet: 1.0 },
  STORM: { goal: 0.88, possNoise: 1.8, injury: 1.3, wet: 1.5 },
  SNOW: { goal: 0.85, possNoise: 1.8, injury: 1.25, wet: 2.0 },
  HEAT: { goal: 0.95, possNoise: 1.0, injury: 1.2, wet: 0.0 },
};

const PITCH_EFFECT: Record<PitchState, { home: number; away: number; goal: number; injury: number }> = {
  EXCELLENT: { home: 1.0, away: 1.0, goal: 1.0, injury: 1.0 },
  GOOD: { home: 1.0, away: 1.0, goal: 1.0, injury: 1.0 },
  WORN: { home: 1.02, away: 0.98, goal: 1.0, injury: 1.05 },
  HEAVY: { home: 1.03, away: 0.96, goal: 0.96, injury: 1.1 },
};

type Band = "COLD" | "TEMPERATE" | "HOT";

function climateBand(regionIndex: number): Band {
  if (regionIndex <= 2) return "COLD";
  if (regionIndex <= 6) return "TEMPERATE";
  return "HOT";
}

const WEATHER_TABLE: Record<Band, Array<[WeatherType, number]>> = {
  COLD: [["CLEAR", 28], ["CLOUDY", 25], ["RAIN", 18], ["WIND", 14], ["SNOW", 12], ["STORM", 3]],
  TEMPERATE: [["CLEAR", 35], ["CLOUDY", 27], ["RAIN", 16], ["WIND", 12], ["STORM", 6], ["HEAT", 4]],
  HOT: [["CLEAR", 40], ["CLOUDY", 22], ["HEAT", 20], ["RAIN", 8], ["STORM", 7], ["WIND", 3]],
};

const TEMP_RANGE: Record<Band, [number, number]> = { COLD: [-4, 9], TEMPERATE: [10, 22], HOT: [24, 38] };

function pickWeighted<T extends string>(rng: () => number, table: Array<[T, number]>): T {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [value, w] of table) {
    r -= w;
    if (r <= 0) return value;
  }
  return table[table.length - 1][0];
}

/** Stadium quality minus weather wear → pitch state (deterministic, no rng). */
export function derivePitch(stadiumLevel: number, weather: WeatherType): PitchState {
  const wear: Record<WeatherType, number> = {
    CLEAR: 0, CLOUDY: 0, WIND: 0, HEAT: 1, RAIN: 2, STORM: 4, SNOW: 4,
  };
  const score = Math.max(0, stadiumLevel * 2 - wear[weather]);
  if (score >= 8) return "EXCELLENT";
  if (score >= 6) return "GOOD";
  if (score >= 4) return "WORN";
  return "HEAVY";
}

export function deriveConditions(seedStr: string, input: ConditionsInput): MatchConditions {
  const rng = mulberry32(seedFromString(`KMIE-COND:${seedStr}`));

  // ── Disabled path: neutral conditions (admin switch), still deterministic.
  if (!input.weatherEnabled && !input.pitchEnabled) {
    return {
      weather: "CLEAR", tempC: 18, windKmh: 8, pitch: "GOOD",
      homeGoalMul: 1, awayGoalMul: 1, possessionNoiseMul: 1, injuryFactor: 1,
      cardMul: 1, referee: "NORMAL", homeFormMul: 1, awayFormMul: 1,
    };
  }

  const band = climateBand(input.regionIndex);
  const weather = pickWeighted(rng, WEATHER_TABLE[band]);
  const [tMin, tMax] = TEMP_RANGE[band];
  const tempC = Math.round(tMin + rng() * (tMax - tMin));
  const windKmh = Math.round(4 + rng() * (weather === "STORM" || weather === "WIND" ? 70 : 26));

  // Pitch: only meaningful when pitchEnabled; a disabled pitch keeps GOOD (neutral).
  const pitch = input.pitchEnabled ? derivePitch(Math.max(1, Math.min(5, input.homeStadiumLevel)), weather) : "GOOD";

  const w = WEATHER_EFFECT[weather];
  const p = PITCH_EFFECT[pitch];
  const weatherGoalMul = input.weatherEnabled ? w.goal : 1;
  const pitchGoalMul = input.pitchEnabled ? p.goal : 1;
  const baseGoal = weatherGoalMul * pitchGoalMul;
  // Bad pitches amplify home advantage (the home side trains on this surface).
  const homeGoalMul = input.pitchEnabled && pitch !== "EXCELLENT" && pitch !== "GOOD" ? baseGoal * p.home : baseGoal;
  const awayGoalMul = input.pitchEnabled && pitch !== "EXCELLENT" && pitch !== "GOOD" ? baseGoal * p.away : baseGoal;

  // Referee strictness: variance around 1.0, then weather wetness nudges fouls.
  const refVar = Math.max(0, Math.min(40, input.refereeVariancePct)) / 100;
  const cardMul = (1 - refVar + rng() * refVar * 2) * (1 + w.wet * 0.04);
  const referee: RefereeMood = cardMul > 1.1 ? "STRICT" : cardMul < 0.95 ? "LENIENT" : "NORMAL";

  // Hidden day-form: symmetric for both teams, never biased toward underdogs.
  const pct = Math.max(0, Math.min(30, input.dayFormPct)) / 100;
  const formMul = () => (rng() < pct ? (rng() < 0.5 ? 1.18 : 0.82) : 1);

  return {
    weather,
    tempC,
    windKmh,
    pitch,
    homeGoalMul,
    awayGoalMul,
    possessionNoiseMul: input.weatherEnabled ? w.possNoise : 1,
    injuryFactor: (input.weatherEnabled ? w.injury : 1) * (input.pitchEnabled ? p.injury : 1),
    cardMul,
    referee,
    homeFormMul: formMul(),
    awayFormMul: formMul(),
  };
}

/** Medical/sports-science dampener: level (MEDICAL_CENTER + SPORTS_SCIENCE) reduces injury chance up to −30%. */
export function medicalInjuryMul(medicalLevel: number, scienceLevel: number): number {
  const reduction = (Math.max(1, medicalLevel) - 1) * 0.075 + (Math.max(1, scienceLevel) - 1) * 0.075;
  return Math.max(0.7, 1 - reduction);
}
