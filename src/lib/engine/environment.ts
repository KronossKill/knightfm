// Knight FM — KMIE v3 environment layer (Task 50-a, spec §7.1 D-007 extension).
// Weather (11 states) and pitch surface (8 states) are derived DETERMINISTICALLY
// from named seeds built on the fixture id — NEVER Math.random():
//   weather  → seed `KMIE-W:{fixtureId}`
//   pitch    → seed `KMIE-P:{fixtureId}` (+ the already-derived weather)
// Same fixture ⇒ same weather/pitch forever (retroactive and reproducible),
// matching the engine's causal/seeded contract. No scripted outcomes: the
// weather only shifts probability weights, it never decides results.

import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { PitchType, Weather } from "@/lib/types";

// ─────────────────────────── Weather ───────────────────────────

/**
 * Effect multipliers per weather state. All simulation effects are applied to
 * BOTH teams symmetrically except `homeAdvantage` (which scales the standard
 * 1.12 home / 0.94 away factors). Field semantics:
 *
 *  lambdaGoal        – multiplier on BOTH teams' goal expectation λ (1.28 base).
 *                      HEAVY_RAIN −12% goals, STORM −20% (before defensiveErrors).
 *  defensiveErrors   – chaos multiplier on BOTH lambdas: bad conditions produce
 *                      more defensive mistakes / goals from errors, partially
 *                      offsetting the lambdaGoal drop (STORM net ≈ 0.80 × 1.06).
 *  possessionVariance– extra width (percentage points) added to the possession
 *                      noise band (±6 base) — erratic conditions, erratic control.
 *  possessionFlatten – 0..1; compresses the midfield-strength share toward 50%.
 *                      Technical possession football suffers on SNOW/HEAVY_RAIN.
 *  homeAdvantage     – fractional modifier on home advantage (CLEAR/HEATWAVE
 *                      +0.02/+0.03 fair-weather home comfort; STORM/FOG −0.04:
 *                      hostile conditions neutralise the crowd edge).
 *  fatiguePenalty    – extra effective FATIGUE POINTS (0..10) added to each
 *                      squad's average fatigue before the fatigue factor
 *                      (factor = 1 − avg/260). HEATWAVE 8 pts ≈ −3% effectiveness.
 */
export interface WeatherEffect {
  lambdaGoal: number;
  defensiveErrors: number;
  possessionVariance: number;
  possessionFlatten: number;
  homeAdvantage: number;
  fatiguePenalty: number;
}

export const WEATHER_EFFECTS: Record<Weather, WeatherEffect> = {
  //             λgoals  defErr possVar flatten homeAdv fatigue
  CLEAR:       { lambdaGoal: 1.00, defensiveErrors: 1.00, possessionVariance: 0, possessionFlatten: 0.00, homeAdvantage: +0.02, fatiguePenalty: 0 },
  CLOUDY:      { lambdaGoal: 1.00, defensiveErrors: 1.00, possessionVariance: 0, possessionFlatten: 0.00, homeAdvantage:  0.00, fatiguePenalty: 0 },
  OVERCAST:    { lambdaGoal: 0.99, defensiveErrors: 1.00, possessionVariance: 1, possessionFlatten: 0.00, homeAdvantage:  0.00, fatiguePenalty: 0 },
  LIGHT_RAIN:  { lambdaGoal: 0.95, defensiveErrors: 1.03, possessionVariance: 2, possessionFlatten: 0.05, homeAdvantage: -0.01, fatiguePenalty: 1 },
  HEAVY_RAIN:  { lambdaGoal: 0.88, defensiveErrors: 1.08, possessionVariance: 4, possessionFlatten: 0.15, homeAdvantage: -0.02, fatiguePenalty: 3 },
  STORM:       { lambdaGoal: 0.80, defensiveErrors: 1.06, possessionVariance: 6, possessionFlatten: 0.20, homeAdvantage: -0.04, fatiguePenalty: 5 },
  WINDY:       { lambdaGoal: 0.94, defensiveErrors: 1.06, possessionVariance: 8, possessionFlatten: 0.10, homeAdvantage: -0.03, fatiguePenalty: 2 },
  SNOW:        { lambdaGoal: 0.85, defensiveErrors: 1.10, possessionVariance: 5, possessionFlatten: 0.30, homeAdvantage: -0.02, fatiguePenalty: 4 },
  HEATWAVE:    { lambdaGoal: 0.94, defensiveErrors: 1.00, possessionVariance: 0, possessionFlatten: 0.00, homeAdvantage: +0.03, fatiguePenalty: 8 },
  FOG:         { lambdaGoal: 0.96, defensiveErrors: 1.05, possessionVariance: 3, possessionFlatten: 0.10, homeAdvantage: -0.01, fatiguePenalty: 0 },
  HUMID:       { lambdaGoal: 0.97, defensiveErrors: 1.02, possessionVariance: 1, possessionFlatten: 0.00, homeAdvantage: +0.01, fatiguePenalty: 5 },
};

/**
 * Weighted (NON-uniform) climate distribution — pleasant football days are the
 * norm, extremes are rare. Weights are relative (sum 100).
 */
const WEATHER_WEIGHTS: [Weather, number][] = [
  ["CLEAR", 24], ["CLOUDY", 20], ["OVERCAST", 12], ["LIGHT_RAIN", 10],
  ["WINDY", 8], ["HUMID", 7], ["FOG", 6], ["HEAVY_RAIN", 5],
  ["HEATWAVE", 4], ["SNOW", 3], ["STORM", 1],
];

const WEATHER_TOTAL_WEIGHT = WEATHER_WEIGHTS.reduce((a, [, w]) => a + w, 0);

/** Deterministic weather for a fixture (seed `KMIE-W:{fixtureId}`). */
export function deriveWeather(fixtureId: string): Weather {
  const rng = mulberry32(seedFromString(`KMIE-W:${fixtureId}`));
  let roll = rng() * WEATHER_TOTAL_WEIGHT;
  for (const [weather, weight] of WEATHER_WEIGHTS) {
    roll -= weight;
    if (roll < 0) return weather;
  }
  return "CLOUDY"; // unreachable — final fallback keeps types happy
}

/** Weathers wet enough to plausibly soak a pitch (used by derivePitch). */
const SOAKING_WEATHER: ReadonlySet<Weather> = new Set(["HEAVY_RAIN", "STORM", "SNOW"]);

// ─────────────────────────── Pitch ───────────────────────────

/**
 * Effect multipliers per pitch surface. Field semantics:
 *
 *  tacticsMod     – multiplier on BOTH teams' tacticsFactor (formation
 *                   familiarity output): bad surfaces punish intricate play.
 *  homeAffinity   – fractional tacticsFactor BONUS for the HOME side only —
 *                   the local club trains on this surface every week.
 *  awayAgePenalty – fractional tacticsFactor penalty applied to the AWAY side
 *                   when its XI average age exceeds 30 (ARTIFICIAL turf is
 *                   hard on older legs). 0 = no age-based penalty.
 */
export interface PitchEffect {
  tacticsMod: number;
  homeAffinity: number;
  awayAgePenalty: number;
}

export const PITCH_EFFECTS: Record<PitchType, PitchEffect> = {
  //            tactics  homeAff  awayAge
  DUSTY:      { tacticsMod: 0.97, homeAffinity: 0.02, awayAgePenalty: 0 },
  POOR:       { tacticsMod: 0.96, homeAffinity: 0.02, awayAgePenalty: 0 },
  AVERAGE:    { tacticsMod: 1.00, homeAffinity: 0.01, awayAgePenalty: 0 },
  GOOD:       { tacticsMod: 1.02, homeAffinity: 0.02, awayAgePenalty: 0 },
  EXCELLENT:  { tacticsMod: 1.04, homeAffinity: 0.02, awayAgePenalty: 0 },
  HYBRID:     { tacticsMod: 1.05, homeAffinity: 0.02, awayAgePenalty: 0 },
  ARTIFICIAL: { tacticsMod: 1.01, homeAffinity: 0.03, awayAgePenalty: 0.03 },
  WET:        { tacticsMod: 0.95, homeAffinity: 0.02, awayAgePenalty: 0 },
};

/**
 * Base surface candidates by STADIUM level (Facility type STADIUM, level 1..10):
 * humble grounds are dusty/poor/artificial, elite stadiums run hybrid grass.
 * `derivePitch` rolls among the candidates for the level's tier.
 */
const PITCH_BY_LEVEL: { min: number; max: number; options: PitchType[] }[] = [
  { min: 1, max: 1, options: ["DUSTY", "POOR", "ARTIFICIAL"] },
  { min: 2, max: 2, options: ["POOR", "AVERAGE", "ARTIFICIAL"] },
  { min: 3, max: 3, options: ["AVERAGE", "POOR"] },
  { min: 4, max: 4, options: ["AVERAGE", "GOOD"] },
  { min: 5, max: 6, options: ["GOOD", "AVERAGE", "EXCELLENT"] },
  { min: 7, max: 8, options: ["EXCELLENT", "GOOD"] },
  { min: 9, max: 10, options: ["HYBRID", "EXCELLENT"] },
];

/**
 * Deterministic pitch surface for a fixture: stadium tier of the HOME club +
 * seeded variation (`KMIE-P:{fixtureId}`). Soaking weather (HEAVY_RAIN/STORM/
 * SNOW) can turn the surface WET (60%) — still fully deterministic because both
 * the weather and the pitch roll come from fixed seeds.
 */
export function derivePitch(stadiumLevel: number | null, fixtureId: string, weather?: Weather): PitchType {
  const rng = mulberry32(seedFromString(`KMIE-P:${fixtureId}`));
  const level = Math.max(1, Math.min(10, stadiumLevel ?? 1));
  const tier = PITCH_BY_LEVEL.find((t) => level >= t.min && level <= t.max) ?? PITCH_BY_LEVEL[0];
  let pitch = tier.options[Math.floor(rng() * tier.options.length)] ?? "AVERAGE";
  if (weather && SOAKING_WEATHER.has(weather) && rng() < 0.6) pitch = "WET";
  return pitch;
}

// ─────────────────────────── Box office ───────────────────────────

/**
 * Stadium SEATING capacity by facility level (documented v3 model, distinct
 * from the squad-capacity ICP in capacity.ts): 5,000 seats at level 1 growing
 * by 3,500 per level → 36,500 at level 10.
 */
export function stadiumCapacity(stadiumLevel: number | null): number {
  const level = Math.max(1, Math.min(10, stadiumLevel ?? 1));
  return 5000 + (level - 1) * 3500;
}

/** Attendance penalty factor for unpleasant weather (money follows comfort). */
const ATTENDANCE_WEATHER_FACTOR: Partial<Record<Weather, number>> = {
  HEAVY_RAIN: 0.88, STORM: 0.80, SNOW: 0.85, HEATWAVE: 0.92, LIGHT_RAIN: 0.95,
  WINDY: 0.95, FOG: 0.97,
};

/** Baseline occupancy by DIVISION index: the top flight fills stadiums,
 * lower divisions draw smaller crowds (floor 30%). */
export function baseOccupancyByDivision(divisionIndex: number): number {
  return Math.max(0.30, 0.80 - (Math.max(1, divisionIndex) - 1) * 0.04);
}

/** Table-position factor: the leader sells out, the bottom side draws ~60%
 * of that (position 1 → 1.00 … position 16 → 0.60, linear). */
export function attendancePositionFactor(position: number, tableSize: number): number {
  const pos = Math.max(1, Math.min(Math.max(1, tableSize), position));
  return 1.0 - ((pos - 1) / Math.max(1, tableSize - 1)) * 0.4;
}

export interface BoxOfficeInput {
  fixtureId: string;
  stadiumLevel: number | null;
  divisionIndex: number;
  homePosition: number; // 1-based standing position (0/null when no table yet)
  tableSize: number;    // clubs in the division (16)
  weather: Weather;
  ticketPriceBase: number; // $Knight per ticket (config matches.ticketPriceBase)
}

/**
 * Deterministic BOX-OFFICE intake for a LEAGUE fixture (seed `KMIE-B:{fixtureId}`).
 *
 *   occupancy = baseOccupancy(division) × positionFactor × weatherFactor × jitter
 *   attendance = floor(stadiumCapacity × occupancy)     (clamped 15%..97%)
 *   revenue    = attendance × ticketPriceBase           (integer $Knight)
 *
 * The jitter (0.92..1.08) comes from the named seed so the same fixture always
 * yields the same crowd. Price 0 (or attendance 0) ⇒ revenue 0 (honest no-op).
 */
export function computeBoxOffice(input: BoxOfficeInput): { attendance: number; revenue: number } {
  const rng = mulberry32(seedFromString(`KMIE-B:${input.fixtureId}`));
  const capacity = stadiumCapacity(input.stadiumLevel);
  const posFactor = input.homePosition > 0 ? attendancePositionFactor(input.homePosition, input.tableSize) : 0.75;
  const weatherFactor = ATTENDANCE_WEATHER_FACTOR[input.weather] ?? 1;
  const jitter = 0.92 + rng() * 0.16;
  const occupancy = Math.max(0.15, Math.min(0.97,
    baseOccupancyByDivision(input.divisionIndex) * posFactor * weatherFactor * jitter));
  const attendance = Math.floor(capacity * occupancy);
  const price = Math.max(0, Math.floor(input.ticketPriceBase));
  return { attendance, revenue: attendance * price };
}
