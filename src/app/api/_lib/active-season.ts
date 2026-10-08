// Knight FM — shared active-season lookup (short in-memory TTL cache).

import { Season } from "@prisma/client";
import { db } from "@/lib/db";
import { SEASON_TOTAL_DAYS } from "@/lib/types";

let cache: { at: number; season: Season | null } | null = null;
const TTL_MS = 30_000;

/** Latest ACTIVE season (falls back to latest season when none is ACTIVE). */
export async function getActiveSeason(): Promise<Season | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.season;
  const season =
    (await db.season.findFirst({ where: { state: "ACTIVE" }, orderBy: { number: "desc" } })) ??
    (await db.season.findFirst({ orderBy: { number: "desc" } }));
  cache = { at: Date.now(), season };
  return season;
}

export function invalidateSeasonCache(): void {
  cache = null;
}

/** Absolute game day of the last (37th) day of the given season. */
export function seasonEndEpochDay(season: Season): number {
  return season.startEpochDay + SEASON_TOTAL_DAYS - 1;
}
