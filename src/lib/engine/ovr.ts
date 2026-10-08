// Knight FM — player quality model (spec §7).
// OVR is a derived summary of attribute profile, position weights and role fit.
// Internal precision is higher than the rounded displayed value.

import { PlayerAttributes, Position, ATTRIBUTE_KEYS } from "@/lib/types";

// Position weights per attribute family (sum normalized inside computation)
export const POSITION_WEIGHTS: Record<Position, { technical: number; physical: number; mental: number }> = {
  GK: { technical: 0.45, physical: 0.2, mental: 0.35 },
  DF: { technical: 0.3, physical: 0.4, mental: 0.3 },
  MF: { technical: 0.42, physical: 0.26, mental: 0.32 },
  FW: { technical: 0.5, physical: 0.3, mental: 0.2 },
};

// Per-attribute importance inside its family (0..1) — administrator-configurable via OVR weight config.
export const ATTRIBUTE_IMPORTANCE: Record<string, number> = {
  finishing: 0.9, passing: 0.7, firstTouch: 0.7, tackling: 0.6, dribbling: 0.7, crossing: 0.6, heading: 0.5,
  handling: 0.95, kicking: 0.8, setPieces: 0.4,
  pace: 0.8, acceleration: 0.75, stamina: 0.8, strength: 0.7, agility: 0.6, balance: 0.5, jumping: 0.55, recovery: 0.6,
  decisions: 0.85, anticipation: 0.8, positioning: 0.8, composure: 0.7, concentration: 0.75, bravery: 0.5,
  workRate: 0.7, reactions: 0.85, leadership: 0.45,
};

export function normalizeAttributes(attrs: PlayerAttributes): Record<string, number> {
  const out: Record<string, number> = {};
  for (const family of Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]) {
    for (const k of ATTRIBUTE_KEYS[family]) {
      const v = attrs[family]?.[k];
      out[k] = typeof v === "number" ? Math.max(1, Math.min(99, v)) : 40;
    }
  }
  return out;
}

/** RawOVR(position) = Σ(normalized_attribute_i × position_weight_i × role_weight_i) — returns 1..99 */
export function computeRawOvr(attrs: PlayerAttributes, position: Position): number {
  const norm = normalizeAttributes(attrs);
  const w = POSITION_WEIGHTS[position];
  let weighted = 0;
  let totalW = 0;
  const familyOf: Record<string, "technical" | "physical" | "mental"> = {};
  for (const fam of Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]) {
    for (const k of ATTRIBUTE_KEYS[fam]) familyOf[k] = fam as "technical" | "physical" | "mental";
  }
  for (const [key, value] of Object.entries(norm)) {
    const fam = familyOf[key] ?? "technical";
    const famW = w[fam];
    const imp = ATTRIBUTE_IMPORTANCE[key] ?? 0.5;
    weighted += (value / 99) * famW * imp;
    totalW += famW * imp;
  }
  const ratio = totalW > 0 ? weighted / totalW : 0;
  return Math.round(ratio * 99);
}

/** ContextualOVR = RawOVR × FitnessFactor × SharpnessFactor × RoleFitFactor × TacticalFitFactor × StateFactor */
export function computeContextualOvr(input: {
  rawOvr: number;
  fatigue: number; // 0..100 (higher = more tired)
  sharpness: number; // 0..100
  morale: number; // 0..100
  confidence: number; // 0..100
  roleFit?: number; // 0..1 (1 = perfect fit)
  tacticalFit?: number; // 0..1
}): number {
  const fitness = 1 - (Math.max(0, Math.min(100, input.fatigue)) / 100) * 0.35; // max -35%
  const sharp = 0.75 + (Math.max(0, Math.min(100, input.sharpness)) / 100) * 0.25; // 0.75..1
  const state = 0.9 + ((input.morale + input.confidence) / 200) * 0.1; // 0.9..1
  const role = input.roleFit ?? 1;
  const tac = input.tacticalFit ?? 1;
  return input.rawOvr * fitness * sharp * state * role * tac;
}

export function starsFromOvr(ovr: number): 1 | 2 | 3 {
  if (ovr >= 75) return 3;
  if (ovr >= 60) return 2;
  return 1;
}

/** Market value formula — integer $Knight, age-sensitive (BASE calculation).
 * Task 27: the player's stored market VALUE is the base calculation multiplied
 * by market.playerValueMultiplier (default 3) — see applyValueMultiplier.
 * Salaries still derive from the BASE value so wage bills stay sustainable. */
export function computeBaseMarketValue(ovr: number, age: number): number {
  const base = 40 * Math.pow(Math.max(ovr, 20) / 40, 4.2);
  let ageFactor = 1;
  if (age <= 21) ageFactor = 1.35;
  else if (age <= 25) ageFactor = 1.2;
  else if (age <= 29) ageFactor = 1.0;
  else if (age <= 32) ageFactor = 0.75;
  else ageFactor = 0.45;
  return Math.max(10, Math.round(base * ageFactor));
}

/** Default value multiplier (mirrors market.playerValueMultiplier default). */
export const DEFAULT_PLAYER_VALUE_MULTIPLIER = 3;

/** Task 27: player VALUE = system calculation × multiplier (default 3).
 * Applied at every player-creation site (seed, free-agent rotation, youth
 * promotion); a one-time backfill multiplies pre-existing stored values. */
export function applyValueMultiplier(baseValue: number, multiplier: number): number {
  const m = Math.max(1, Math.min(1000, Math.round(multiplier) || 1));
  return Math.max(1, Math.round(baseValue * m));
}

/** Convenience wrapper: base value × default multiplier (used where the
 * config layer is unavailable, e.g. the seed script before config rows exist). */
export function computeMarketValue(ovr: number, age: number, multiplier = DEFAULT_PLAYER_VALUE_MULTIPLIER): number {
  return applyValueMultiplier(computeBaseMarketValue(ovr, age), multiplier);
}

export function computeSalary(marketValue: number, ratePct: number): number {
  return Math.max(1, Math.floor((marketValue * ratePct) / 100));
}

export function computeReleaseClause(marketValue: number, multiplier: number): number {
  return marketValue * multiplier;
}

/** Position eligibility for a slot (used by tactical board + auto-complete). */
export function positionFit(playerPos: Position, slotPos: Position): number {
  if (playerPos === slotPos) return 1;
  const matrix: Record<Position, Partial<Record<Position, number>>> = {
    GK: {},
    DF: { MF: 0.55 },
    MF: { DF: 0.6, FW: 0.6 },
    FW: { MF: 0.6 },
  };
  return matrix[playerPos][slotPos] ?? 0.25;
}
