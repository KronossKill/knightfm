// Knight FM — KMIE match engine (spec §7.1, D-007).
// Causal, probabilistic, reproducible from seed + state. No scripted results, no rubber-banding.
// Superior teams get probability advantages, never guarantees.

import { createHash } from "crypto";
import type { MatchConditions } from "@/lib/engine/conditions";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromString(s: string): number {
  const h = createHash("sha256").update(s).digest();
  return h.readUInt32BE(0);
}

export function poissonSample(rng: () => number, lambda: number): number {
  const L = Math.exp(-Math.max(lambda, 0));
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 25);
  return k - 1;
}

export interface TeamStrengthInput {
  attackOvr: number; // avg contextual OVR of attacking units (0..99)
  midfieldOvr: number;
  defenseOvr: number;
  gkOvr: number;
  tacticsFactor: number; // 0.85..1.15 from formation familiarity / in/out possession choices
  fatigueFactor: number; // 0.85..1.0
  // KMIE 2.0 (Task 100): style factors from Lineup.inPossession / outOfPossession.
  // When absent, tacticsFactor is used (backward compatible with verify scripts).
  attackFactor?: number; // in-possession style (possession/direct/counter)
  defenseFactor?: number; // out-of-possession style (press/block)
  possessionBias?: number; // -5..+5 possession share points from style
}

export interface MatchSimResult {
  homeGoals: number;
  awayGoals: number;
  possessionHome: number; // percent
  shotsHome: number;
  shotsAway: number;
  xgHomeX100: number;
  xgAwayX100: number;
  seed: string;
}

function teamLambda(own: TeamStrengthInput, opp: TeamStrengthInput, homeAdvantage: number): number {
  const atkF = own.attackFactor ?? own.tacticsFactor;
  const defF = opp.defenseFactor ?? opp.tacticsFactor;
  const attack = own.attackOvr * atkF * own.fatigueFactor;
  const defense = opp.defenseOvr * defF * opp.fatigueFactor;
  const gk = opp.gkOvr;
  const ratio = attack / Math.max((defense * 0.75 + gk * 0.25), 20);
  const base = 1.28;
  return Math.max(0.15, Math.min(4.5, base * Math.pow(ratio, 1.7) * homeAdvantage));
}

export function simulateMatch(
  seedStr: string,
  home: TeamStrengthInput,
  away: TeamStrengthInput,
  conditions?: MatchConditions
): MatchSimResult {
  const rng = mulberry32(seedFromString(seedStr));
  const λHomeRaw = teamLambda(home, away, 1.12);
  const λAwayRaw = teamLambda(away, home, 0.94);
  // KMIE 2.0 (Task 100): weather/pitch multipliers + hidden day-form. Applied to
  // the raw lambdas so shots/xG stay correlated with the final scoring rates.
  const λHome = Math.max(0.1, Math.min(5.2, λHomeRaw * (conditions?.homeGoalMul ?? 1) * (conditions?.homeFormMul ?? 1)));
  const λAway = Math.max(0.1, Math.min(5.2, λAwayRaw * (conditions?.awayGoalMul ?? 1) * (conditions?.awayFormMul ?? 1)));

  const homeGoals = poissonSample(rng, λHome);
  const awayGoals = poissonSample(rng, λAway);

  // Shots and xG correlate with lambdas + noise
  const shotsHome = Math.max(2, Math.round(λHome * 5 + rng() * 5));
  const shotsAway = Math.max(1, Math.round(λAway * 5 + rng() * 4));
  const xgHomeX100 = Math.round(λHome * 100 * (0.8 + rng() * 0.4));
  const xgAwayX100 = Math.round(λAway * 100 * (0.8 + rng() * 0.4));

  // Possession from midfield strength with noise (KMIE 2.0: style bias + weather noise)
  const midShare = home.midfieldOvr / Math.max(home.midfieldOvr + away.midfieldOvr, 1);
  const styleBias = ((home.possessionBias ?? 0) - (away.possessionBias ?? 0)) / 2;
  const noiseMul = conditions?.possessionNoiseMul ?? 1;
  const possessionHome = Math.max(25, Math.min(75, Math.round(midShare * 100 + styleBias + (rng() - 0.5) * 12 * noiseMul)));

  return { homeGoals, awayGoals, possessionHome, shotsHome, shotsAway, xgHomeX100, xgAwayX100, seed: seedStr };
}

/** Deterministic shuffle (Fisher–Yates with seeded rng). */
export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
