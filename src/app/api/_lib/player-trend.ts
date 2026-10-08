// Knight FM — per-attribute growth trend (current attributes vs latest
// AttributeSnapshot within the last 14 days). Computed SERVER-SIDE so the
// client never sees raw snapshot diffs (scouting-limits friendly).

import { db } from "@/lib/db";
import { PlayerAttributes } from "@/lib/types";

/** The ~9 key attributes surfaced in the UI trend chips. */
export const TREND_ATTRS = [
  "finishing",
  "passing",
  "dribbling",
  "tackling",
  "handling",
  "pace",
  "stamina",
  "decisions",
  "positioning",
] as const;

export type Trend = "up" | "down" | "flat";
export type TrendMap = Record<string, Trend>;

const TREND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

type FamilyShape = Record<string, Record<string, number>>;

function flattenAttrs(parsed: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!parsed || typeof parsed !== "object") return out;
  const src = parsed as FamilyShape;
  for (const family of ["technical", "physical", "mental"] as const) {
    const fam = src[family];
    if (fam && typeof fam === "object") {
      for (const [key, value] of Object.entries(fam)) {
        if (typeof value === "number") out[key] = value;
      }
    }
  }
  return out;
}

function parseAttrJson(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    return flattenAttrs(JSON.parse(raw) as PlayerAttributes);
  } catch {
    return {};
  }
}

export async function computeTrendMap(playerId: string, currentAttributesRaw: string): Promise<TrendMap> {
  const trend: TrendMap = {};
  for (const key of TREND_ATTRS) trend[key] = "flat";

  const snapshot = await db.attributeSnapshot.findFirst({
    where: { playerId, createdAt: { gte: new Date(Date.now() - TREND_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { attributes: true },
  });
  if (!snapshot) return trend; // no recent snapshot ⇒ neutral trend

  const current = parseAttrJson(currentAttributesRaw);
  const previous = parseAttrJson(snapshot.attributes);
  for (const key of TREND_ATTRS) {
    const nowVal = current[key];
    const prevVal = previous[key];
    if (typeof nowVal !== "number" || typeof prevVal !== "number") continue;
    if (nowVal > prevVal) trend[key] = "up";
    else if (nowVal < prevVal) trend[key] = "down";
  }
  return trend;
}
