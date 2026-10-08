// Knight FM — KMIE match engine (spec §7.1, D-007).
// Causal, probabilistic, reproducible from seed + state. No scripted results, no rubber-banding.
// Superior teams get probability advantages, never guarantees.

import { createHash } from "crypto";

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
  const attack = own.attackOvr * own.tacticsFactor * own.fatigueFactor;
  const defense = opp.defenseOvr * opp.tacticsFactor * opp.fatigueFactor;
  const gk = opp.gkOvr;
  const ratio = attack / Math.max((defense * 0.75 + gk * 0.25), 20);
  const base = 1.28;
  return Math.max(0.15, Math.min(4.5, base * Math.pow(ratio, 1.7) * homeAdvantage));
}

export function simulateMatch(seedStr: string, home: TeamStrengthInput, away: TeamStrengthInput): MatchSimResult {
  const rng = mulberry32(seedFromString(seedStr));
  const λHome = teamLambda(home, away, 1.12);
  const λAway = teamLambda(away, home, 0.94);

  const homeGoals = poissonSample(rng, λHome);
  const awayGoals = poissonSample(rng, λAway);

  // Shots and xG correlate with lambdas + noise
  const shotsHome = Math.max(2, Math.round(λHome * 5 + rng() * 5));
  const shotsAway = Math.max(1, Math.round(λAway * 5 + rng() * 4));
  const xgHomeX100 = Math.round(λHome * 100 * (0.8 + rng() * 0.4));
  const xgAwayX100 = Math.round(λAway * 100 * (0.8 + rng() * 0.4));

  // Possession from midfield strength with noise
  const midShare = home.midfieldOvr / Math.max(home.midfieldOvr + away.midfieldOvr, 1);
  const possessionHome = Math.max(25, Math.min(75, Math.round(midShare * 100 + (rng() - 0.5) * 12)));

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
