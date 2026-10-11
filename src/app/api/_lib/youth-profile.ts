// Knight FM — shared YOUTH → SENIOR player profile mapping (spec §7, Task 21/23/27).
// ONE mapping, TWO exits:
//   • POST /api/youth/promote — the prospect SIGNS for the club (senior squad).
//   • DELETE /api/youth/prospects/[id] — the club REJECTS the prospect: the kid is
//     NOT destroyed; they become a FREE AGENT (clubId null, isFreeAgent) built with
//     the exact same profile they would have received on promotion (user mandate:
//     a scouted prospect rejected by the club goes to the free-agent market).
// Deterministic: the attribute jitter is seeded from the prospect id
// (`PROMOTE:<prospectId>`), so the same prospect always maps to the same senior
// player regardless of which exit consumed the row.

import {
  computeBaseMarketValue,
  applyValueMultiplier,
  computeSalary,
  computeReleaseClause,
  computeRawOvr,
  starsFromOvr,
} from "@/lib/engine/ovr";
import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { ATTRIBUTE_KEYS } from "@/lib/types";
import { getInt } from "@/lib/config";
import { parseJson } from "@/app/api/_lib/club-access";

const DETAILED_BY_POSITION: Record<string, string> = { GK: "GK", DF: "CB", MF: "CM", FW: "ST" };

interface FamilyAttrs {
  technical?: Record<string, number>;
  physical?: Record<string, number>;
  mental?: Record<string, number>;
  [key: string]: unknown;
}

export interface ProspectLike {
  id: string;
  age: number;
  position: string;
  quality: number;
  attributes: string;
}

export interface SeniorPlayerProfile {
  position: "GK" | "DF" | "MF" | "FW";
  detailedPos: string;
  attributes: Record<string, Record<string, number>>;
  ovr: number;
  potential: number;
  stars: 1 | 2 | 3;
  baseValue: number;
  marketValue: number;
  salary: number;
  releaseClause: number;
}

/** Quality→senior mapping (identical to the original promote implementation). */
export async function buildSeniorPlayerProfile(prospect: ProspectLike): Promise<SeniorPlayerProfile> {
  const position = prospect.position as "GK" | "DF" | "MF" | "FW";
  const rng = mulberry32(seedFromString(`PROMOTE:${prospect.id}`));
  const src = parseJson<FamilyAttrs>(prospect.attributes, {});
  const targetOvr = Math.max(30, Math.min(58, Math.round(prospect.quality * 0.5 + 22)));

  const attributes: Record<string, Record<string, number>> = { technical: {}, physical: {}, mental: {} };
  for (const family of Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]) {
    for (const key of ATTRIBUTE_KEYS[family]) {
      const srcVal = src[family]?.[key];
      const base = typeof srcVal === "number" ? srcVal : prospect.quality;
      attributes[family][key] = Math.max(1, Math.min(99, Math.round(targetOvr + (base - prospect.quality) + (rng() * 4 - 2))));
    }
  }
  // Keep the cached OVR consistent with the generated attribute profile.
  const computedOvr = computeRawOvr(
    { technical: attributes.technical, physical: attributes.physical, mental: attributes.mental },
    position
  );
  const finalOvr = Math.max(30, Math.min(58, computedOvr || targetOvr));

  const [salaryPct, clauseMult, valueMult] = await Promise.all([
    getInt("economy.playerSalaryRatePct", 1),
    getInt("economy.releaseClauseMultiplier", 5),
    getInt("market.playerValueMultiplier", 3),
  ]);
  // Task 27: stored VALUE = base × market.playerValueMultiplier (default 3);
  // the salary derives from the BASE value so wage bills stay sustainable.
  const baseValue = computeBaseMarketValue(finalOvr, prospect.age);
  const marketValue = applyValueMultiplier(baseValue, valueMult);

  return {
    position,
    detailedPos: DETAILED_BY_POSITION[position] ?? position,
    attributes,
    ovr: finalOvr,
    potential: Math.min(95, Math.max(finalOvr + 6, Math.round(prospect.quality * 0.9 + 18))),
    stars: starsFromOvr(finalOvr),
    baseValue,
    marketValue,
    salary: computeSalary(baseValue, salaryPct),
    releaseClause: computeReleaseClause(marketValue, clauseMult),
  };
}
