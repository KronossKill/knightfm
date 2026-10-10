// Knight FM — training session engine.
// Shared by POST /api/training/run. Session limits (default: 1 general per day +
// 1 of each special type per day) are configurable via training.* config keys
// and enforced by counting TrainingSession rows for (clubId, day).
// Effects mirror the historical scheduler formulas: training-center level +
// coach quality + training.growthFactor, with mandatory randomness.

import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { ATTRIBUTE_KEYS, COACH_SPECIALIZATIONS, FacilityType } from "@/lib/types";

export const TRAINING_GENERAL = ["balanced", "physical", "technical", "mental", "recovery"] as const;
export type TrainingGeneralFocus = (typeof TRAINING_GENERAL)[number];

export const TRAINING_SPECIAL_TYPES = [
  "goalkeeper",
  "defense",
  "midfield",
  "wide",
  "attack",
  "physical",
  "set_pieces",
] as const;
export type TrainingSpecialType = (typeof TRAINING_SPECIAL_TYPES)[number];

export const GENERAL_KIND = "GENERAL";

/** SECURITY (pentest fix): typed error for the atomic daily-limit claims. */
export class TrainingLimitError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
export const specialKind = (type: string) => `SPECIAL:${type}`;

type AttributeFamily = keyof typeof ATTRIBUTE_KEYS;

function familyOfAttr(key: string): AttributeFamily {
  for (const fam of Object.keys(ATTRIBUTE_KEYS) as AttributeFamily[]) {
    if (ATTRIBUTE_KEYS[fam].includes(key)) return fam;
  }
  return "technical";
}

/** Coach-quality average for the club (0 coaches → 40 baseline). */
async function coachQualityFor(clubId: string): Promise<number> {
  const coaches = await db.staffMember.findMany({ where: { clubId, role: "COACH" } });
  if (coaches.length === 0) return 40;
  return coaches.reduce((a, c) => a + c.quality, 0) / coaches.length;
}

// ─── Multi-factor growth formula (Task 25-c) ──────────────────────

export interface TrainingOpts {
  /** Player condition 0..100 (100 = fully fresh). */
  condition: number;
  /** Player age in years. */
  age: number;
  /** Cached overall rating of the player. */
  ovr: number;
  /** Average COACH quality for the club (baseline 40 when no coach). */
  coachQuality: number;
  /** TRAINING_CENTER facility level. */
  tcLevel: number;
}

export interface TrainingWeights {
  condition: number;
  age: number;
  quality: number;
  coach: number;
  facility: number;
}

export interface TrainingFactors {
  fCondition: number;
  fAge: number;
  fQuality: number;
  fCoach: number;
  fFacility: number;
}

export interface TrainingBreakdown extends TrainingFactors {
  /** Raw factor values (before weights). */
  fCondition: number;
  fAge: number;
  fQuality: number;
  fCoach: number;
  fFacility: number;
  /** Configured weights (0..2, 1 = default 100%). */
  weights: TrainingWeights;
  /** Effective multipliers actually applied: 1 + w × (f − 1). */
  eff: TrainingWeights;
  /** Preview pct WITHOUT randomness: basePct × growth × Π(eff_f), min 0.2. */
  finalPct: number;
}

const clampN = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * Raw multi-factor values for one training target.
 *  - fCondition 0.60..1.40 (fresh players learn much more)
 *  - fAge       0.50..1.30 (young players learn more)
 *  - fQuality   0.60..1.15 (high-OVR players are harder to improve)
 *  - fCoach     0.80..1.25 (better coaches unlock more)
 *  - fFacility  0.90..1.26 (training-center level matters)
 */
export function trainingFactorValues(o: TrainingOpts): TrainingFactors {
  return {
    fCondition: 0.60 + 0.80 * (clampN(o.condition, 0, 100) / 100),
    fAge: clampN(1.30 - 0.035 * (o.age - 15), 0.50, 1.30),
    fQuality: clampN(1.15 - 0.005 * (o.ovr - 40), 0.60, 1.15),
    fCoach: clampN(0.80 + (0.45 * (o.coachQuality - 20)) / 72, 0.80, 1.25),
    fFacility: clampN(0.90 + 0.04 * (o.tcLevel - 1), 0.90, 1.26),
  };
}

/** Configured factor weights as fractions (config 0..200 → 0..2). */
export async function getTrainingWeights(): Promise<TrainingWeights> {
  const [condition, age, quality, coach, facility] = await Promise.all([
    getInt("training.weight.condition", 100),
    getInt("training.weight.age", 100),
    getInt("training.weight.quality", 100),
    getInt("training.weight.coach", 100),
    getInt("training.weight.facility", 100),
  ]);
  return { condition: condition / 100, age: age / 100, quality: quality / 100, coach: coach / 100, facility: facility / 100 };
}

/** Weighted effective multiplier: w=0 → neutral 1.0; w=1 → f; w=2 → doubles the deviation. */
function effOf(w: number, f: number): number {
  return 1 + w * (f - 1);
}

function breakdownFrom(basePct: number, o: TrainingOpts, weights: TrainingWeights, growth: number): TrainingBreakdown {
  const f: TrainingFactors = trainingFactorValues(o);
  const eff: TrainingWeights = {
    condition: effOf(weights.condition, f.fCondition),
    age: effOf(weights.age, f.fAge),
    quality: effOf(weights.quality, f.fQuality),
    coach: effOf(weights.coach, f.fCoach),
    facility: effOf(weights.facility, f.fFacility),
  };
  const mult = eff.condition * eff.age * eff.quality * eff.coach * eff.facility;
  const finalPct = Math.max(0.2, basePct * growth * mult);
  return {
    fCondition: r3(f.fCondition),
    fAge: r3(f.fAge),
    fQuality: r3(f.fQuality),
    fCoach: r3(f.fCoach),
    fFacility: r3(f.fFacility),
    weights,
    eff: {
      condition: r3(eff.condition),
      age: r3(eff.age),
      quality: r3(eff.quality),
      coach: r3(eff.coach),
      facility: r3(eff.facility),
    },
    finalPct: r2(finalPct),
  };
}

/**
 * Deterministic preview of the session pct for UI/server responses (no random).
 * Weights come from config (training.weight.*, 100 = full factor effect).
 */
export async function computeTrainingBreakdown(basePct: number, o: TrainingOpts): Promise<TrainingBreakdown> {
  const [weights, growth] = await Promise.all([getTrainingWeights(), growthFactor()]);
  return breakdownFrom(basePct, o, weights, growth);
}

/**
 * Effective growth percent for a session: base config percent scaled by the
 * growth factor and the five weighted factors (condition, age, quality, coach,
 * facility), with mandatory randomness (±25%) so sessions never feel mechanical.
 */
export async function effectivePct(basePct: number, opts: TrainingOpts): Promise<number> {
  const bd = await computeTrainingBreakdown(basePct, opts);
  return Math.max(0.2, bd.finalPct * (0.75 + Math.random() * 0.5));
}

// ─── Growth pacing (absolute-pace model — sustainable development) ────
// Percent-based gains ("+1.9% of 55 every session") made high attributes grow
// as fast as low ones and let a dedicated squad max out in WEEKS. The engine
// now grows attributes by ABSOLUTE PACE points scaled by the five factors, with:
//  - a per-attribute EFFECTIVE CEILING derived from the player's potential
//    (deterministic −4..+5 jitter so squads are not uniform),
//  - LINEAR DIMINISHING RETURNS across the last TRAINING_SOFT_ZONE points
//    before that ceiling (classic FM-style late-game slowdown),
//  - unbiased probabilistic rounding so sub-1.0 expected gains accumulate
//    statistically instead of being floored to +1 every session.
// Net effect at default pace (training.paceGeneral=30 / training.paceSpecial=42):
// a 5-star prospect with optimal coach + training center, dedicating every
// special session to him, reaches his ceiling around AGE 29 (a lucky few ~27);
// lower potentials plateau naturally at their own level and never overflow.

/** Attribute points of headroom over the ceiling where gains taper linearly to 0. */
export const TRAINING_SOFT_ZONE = 18;

/** Deterministic per-(player, attribute) ceiling: potential −4..+5 (clamped 40..99). */
export function attributeCeiling(playerId: string, attr: string, potential: number): number {
  let h = 0;
  const key = `${playerId}|${attr}`;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const jitter = (h % 10) - 4;
  return Math.max(40, Math.min(99, potential + jitter));
}

/** Configured pace in ABSOLUTE attribute points (x0.001) per session per attribute. */
async function trainingPace(): Promise<{ general: number; special: number }> {
  const [g, s] = await Promise.all([
    getInt("training.paceGeneral", 30),
    getInt("training.paceSpecial", 42),
  ]);
  return { general: Math.max(1, g) / 1000, special: Math.max(1, s) / 1000 };
}

/** Expected absolute gain (fractional attribute points) for one attribute. */
export function expectedAttrGain(value: number, pace: number, mult: number, ceiling: number): number {
  if (value >= ceiling) return 0;
  const headroom = ceiling - value;
  const taper = Math.min(1, headroom / TRAINING_SOFT_ZONE);
  return pace * mult * taper;
}

/** Unbiased integer realisation: whole part + probabilistic remainder. */
function realiseGain(expected: number): number {
  if (expected <= 0) return 0;
  const whole = Math.floor(expected);
  return whole + (Math.random() < expected - whole ? 1 : 0);
}

async function facilityLevel(clubId: string, type: FacilityType): Promise<number> {
  const f = await db.facility.findUnique({
    where: { clubId_type: { clubId, type } },
    select: { level: true },
  });
  return f?.level ?? 1;
}

async function growthFactor(): Promise<number> {
  return (await getInt("training.growthFactor", 100)) / 100;
}

/** Recompute the cached position OVR from an attribute profile. */
async function recomputeOvr(
  attrs: Record<string, Record<string, number>>,
  position: string
): Promise<number> {
  const { computeRawOvr } = await import("@/lib/engine/ovr");
  return computeRawOvr(
    {
      technical: attrs.technical ?? {},
      physical: attrs.physical ?? {},
      mental: attrs.mental ?? {},
    },
    position as never
  );
}

// ─── Usage accounting ─────────────────────────────────────────────

export interface TrainingUsage {
  generalUsed: number;
  generalLimit: number;
  specialUsed: Record<string, number>;
  specialLimit: number;
}

export async function getTrainingUsage(clubId: string, day: number): Promise<TrainingUsage> {
  const [generalLimit, specialLimit, sessions] = await Promise.all([
    getInt("training.generalSessionsPerDay", 1),
    getInt("training.specialPerTypePerDay", 1),
    db.trainingSession.findMany({
      where: { clubId, day },
      select: { kind: true, specialType: true },
    }),
  ]);

  const specialUsed: Record<string, number> = {};
  let generalUsed = 0;
  for (const s of sessions) {
    if (s.kind === GENERAL_KIND) generalUsed += 1;
    else if (s.specialType) specialUsed[s.specialType] = (specialUsed[s.specialType] ?? 0) + 1;
  }
  return { generalUsed, generalLimit, specialUsed, specialLimit };
}

// ─── General session (whole squad) ────────────────────────────────

export async function runGeneralSession(
  clubId: string,
  focus: TrainingGeneralFocus,
  day: number
): Promise<{
  players: number;
  focus: string;
  pct: number;
  attrsGained: number;
  breakdown: TrainingBreakdown;
  finalPct: number;
}> {
  const [tc, coachQuality, players, weights, growth, pace] = await Promise.all([
    facilityLevel(clubId, "TRAINING_CENTER"),
    coachQualityFor(clubId),
    db.player.findMany({
      where: { clubId, retired: false, isFreeAgent: false, isYouth: false },
    }),
    getTrainingWeights(),
    growthFactor(),
    trainingPace(),
  ]);

  // SECURITY (pentest fix — concurrent-session race): the daily limit was
  // count-then-act with no atomic guard, so N concurrent requests all read the
  // same usage and each ran a full session (OVR inflation). The session row is
  // now CLAIMED BEFORE any effect is applied; if the claim overflows the
  // configured limit, the claim is removed and a typed error aborts (fail
  // closed — a stuck retry beats free OVR).
  const claim = await db.trainingSession.create({
    data: { clubId, day, kind: GENERAL_KIND, generalFocus: focus, effects: JSON.stringify({ pending: true }) },
  });
  const usageNow = await getTrainingUsage(clubId, day);
  if (usageNow.generalUsed > usageNow.generalLimit) {
    await db.trainingSession.delete({ where: { id: claim.id } }).catch(() => undefined);
    throw new TrainingLimitError("ALREADY_RUN", "Today's general session limit has been reached");
  }

  // General session: EVERY attribute of EVERY squad player grows by a percent.
  // Factors are per-player (condition/age/ovr differ inside the squad); the
  // reported breakdown is the squad average.
  let touched = 0;
  let sumApplied = 0;
  let sumPreview = 0;
  const sumF = { fCondition: 0, fAge: 0, fQuality: 0, fCoach: 0, fFacility: 0 };
  const sumEff = { condition: 0, age: 0, quality: 0, coach: 0, facility: 0 };
  let counted = 0;

  for (const player of players) {
    const attrs = JSON.parse(player.attributes || "{}") as Record<string, Record<string, number>>;
    const current: Record<string, Record<string, number>> = {
      technical: { ...(attrs.technical ?? {}) },
      physical: { ...(attrs.physical ?? {}) },
      mental: { ...(attrs.mental ?? {}) },
    };
    const data: {
      fatigue?: number;
      sharpness?: number;
      morale?: number;
      attributes?: string;
      ovr?: number;
    } = {};

    if (focus === "recovery") {
      data.fatigue = Math.max(0, player.fatigue - 12);
      data.sharpness = Math.max(0, player.sharpness - 1);
      data.morale = Math.min(100, player.morale + 2);
    } else {
      const opts = { condition: 100 - player.fatigue, age: player.age, ovr: player.ovr, coachQuality, tcLevel: tc };
      const f = trainingFactorValues(opts);
      // Absolute-pace model: session intensity = the five weighted factors × randomness.
      const sessionMult =
        effOf(weights.condition, f.fCondition) *
        effOf(weights.age, f.fAge) *
        effOf(weights.quality, f.fQuality) *
        effOf(weights.coach, f.fCoach) *
        effOf(weights.facility, f.fFacility) *
        (0.75 + Math.random() * 0.5);
      const applied = pace.general * growth * sessionMult;
      const bd = breakdownFrom(1, opts, weights, growth);
      sumApplied += applied;
      sumPreview += bd.finalPct;
      sumF.fCondition += bd.fCondition;
      sumF.fAge += bd.fAge;
      sumF.fQuality += bd.fQuality;
      sumF.fCoach += bd.fCoach;
      sumF.fFacility += bd.fFacility;
      sumEff.condition += bd.eff.condition;
      sumEff.age += bd.eff.age;
      sumEff.quality += bd.eff.quality;
      sumEff.coach += bd.eff.coach;
      sumEff.facility += bd.eff.facility;
      counted += 1;

      for (const fam of Object.keys(ATTRIBUTE_KEYS) as AttributeFamily[]) {
        for (const k of ATTRIBUTE_KEYS[fam]) {
          const v = current[fam][k] ?? 40;
          const ceiling = attributeCeiling(player.id, k, player.potential);
          const inc = realiseGain(expectedAttrGain(v, pace.general * growth, sessionMult, ceiling));
          if (inc > 0) {
            current[fam][k] = Math.min(ceiling, v + inc);
            touched += 1;
          }
        }
      }
      data.attributes = JSON.stringify(current);
      data.ovr = await recomputeOvr(current, player.position);
      data.fatigue = Math.min(100, player.fatigue + 4);
      data.sharpness = Math.min(100, player.sharpness + 2);
    }

    await db.player.update({ where: { id: player.id }, data });
  }

  const n = Math.max(1, counted);
  const meanApplied = sumApplied / n;
  const meanPreview = sumPreview / n;
  const breakdown: TrainingBreakdown = {
    fCondition: r3(sumF.fCondition / n),
    fAge: r3(sumF.fAge / n),
    fQuality: r3(sumF.fQuality / n),
    fCoach: r3(sumF.fCoach / n),
    fFacility: r3(sumF.fFacility / n),
    weights,
    eff: {
      condition: r3(sumEff.condition / n),
      age: r3(sumEff.age / n),
      quality: r3(sumEff.quality / n),
      coach: r3(sumEff.coach / n),
      facility: r3(sumEff.facility / n),
    },
    finalPct: r2(meanPreview),
  };

  await db.trainingSession.update({
    where: { id: claim.id },
    data: {
      effects: JSON.stringify({
        players: players.length,
        pct: r3(meanApplied),
        attrsGained: touched,
        breakdown,
      }),
    },
  });

  return {
    players: players.length,
    focus,
    pct: r3(meanApplied),
    attrsGained: touched,
    breakdown,
    finalPct: r3(meanApplied),
  };
}

// ─── Special session (one player) ─────────────────────────────────

export async function runSpecialSession(
  clubId: string,
  type: TrainingSpecialType,
  playerId: string,
  day: number
): Promise<{
  playerId: string;
  type: string;
  pct: number;
  attrsGained: number;
  breakdown: TrainingBreakdown;
  finalPct: number;
}> {
  const [tc, coachQuality, player, weights, growth, pace] = await Promise.all([
    facilityLevel(clubId, "TRAINING_CENTER"),
    coachQualityFor(clubId),
    db.player.findFirst({
      where: { id: playerId, clubId, retired: false, isFreeAgent: false, isYouth: false },
    }),
    getTrainingWeights(),
    growthFactor(),
    trainingPace(),
  ]);
  if (!player) throw new Error("PLAYER_NOT_IN_SQUAD");

  // SECURITY (pentest fix — concurrent-session race): same claim-first pattern
  // as the general session (per-type daily limit enforced atomically).
  const claim = await db.trainingSession.create({
    data: { clubId, day, kind: specialKind(type), specialType: type, playerId: player.id, effects: JSON.stringify({ pending: true }) },
  });
  const usageNow = await getTrainingUsage(clubId, day);
  if ((usageNow.specialUsed[type] ?? 0) > usageNow.specialLimit) {
    await db.trainingSession.delete({ where: { id: claim.id } }).catch(() => undefined);
    throw new TrainingLimitError("ALREADY_RUN", `Today's ${type} session limit has been reached`);
  }

  // Special session: the trained attribute family of THIS player grows by
  // ABSOLUTE PACE points scaled by HIS OWN condition, age and quality (plus
  // club factors), capped by his per-attribute potential ceiling.
  const keys = COACH_SPECIALIZATIONS[type];
  const opts = { condition: 100 - player.fatigue, age: player.age, ovr: player.ovr, coachQuality, tcLevel: tc };
  const f = trainingFactorValues(opts);
  const sessionMult =
    effOf(weights.condition, f.fCondition) *
    effOf(weights.age, f.fAge) *
    effOf(weights.quality, f.fQuality) *
    effOf(weights.coach, f.fCoach) *
    effOf(weights.facility, f.fFacility) *
    (0.75 + Math.random() * 0.5);
  const appliedPct = pace.special * growth * sessionMult;
  const bd = breakdownFrom(1, opts, weights, growth);

  const attrs = JSON.parse(player.attributes || "{}") as Record<string, Record<string, number>>;
  const current: Record<string, Record<string, number>> = {
    technical: { ...(attrs.technical ?? {}) },
    physical: { ...(attrs.physical ?? {}) },
    mental: { ...(attrs.mental ?? {}) },
  };
  let grew = 0;
  for (const k of keys) {
    const fam = familyOfAttr(k);
    const v = current[fam][k] ?? 40;
    const ceiling = attributeCeiling(player.id, k, player.potential);
    const inc = realiseGain(expectedAttrGain(v, pace.special * growth, sessionMult, ceiling));
    if (inc > 0) {
      current[fam][k] = Math.min(ceiling, v + inc);
      grew += 1;
    }
  }

  await db.player.update({
    where: { id: player.id },
    data: {
      attributes: JSON.stringify(current),
      ovr: await recomputeOvr(current, player.position),
      fatigue: Math.min(100, player.fatigue + 3),
      sharpness: Math.min(100, player.sharpness + 2),
    },
  });

  await db.trainingSession.update({
    where: { id: claim.id },
    data: {
      effects: JSON.stringify({
        type,
        pct: r3(appliedPct),
        attrsTouched: keys.length,
        attrsGained: grew,
        breakdown: bd,
      }),
    },
  });

  return {
    playerId: player.id,
    type,
    pct: r3(appliedPct),
    attrsGained: grew,
    breakdown: bd,
    finalPct: r3(appliedPct),
  };
}

// ─── Youth academy quality cap ────────────────────────────────────

/** Signable prospect quality cap for a youth-academy level (configurable). */
export async function academyQualityCap(academyLevel: number): Promise<number> {
  const [base, perLevel] = await Promise.all([
    getInt("youth.academyQualityCapBase", 40),
    getInt("youth.academyQualityCapPerLevel", 10),
  ]);
  return Math.max(0, Math.min(100, base + perLevel * Math.max(1, academyLevel)));
}

// ─── Youth academy CAPACITY (Task 26) ─────────────────────────────

/** Youth capacity = base + perLevel × (level − 1), capped by the absolute
 * pool ceiling. The minimum-level academy (level 1) holds exactly
 * `youth.baseCapacity` prospects (default 3) and every upgrade adds
 * `youth.capacityPerLevel` more — capacity grows as the facility improves. */
export async function getYouthCapacity(academyLevel: number): Promise<number> {
  const [base, perLevel, ceiling] = await Promise.all([
    getInt("youth.baseCapacity", 3),
    getInt("youth.capacityPerLevel", 2),
    getInt("youth.maxProspectsPool", 50),
  ]);
  return Math.max(0, Math.min(base + Math.max(0, academyLevel - 1) * perLevel, ceiling));
}
