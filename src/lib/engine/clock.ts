// Knight FM — UTC world clock (spec §16). UTC is the ONLY authoritative clock.
// GameDay = 1 + floor((UTCNow − WORLD_EPOCH_UTC) / 24h). Rollover at 00:00:00.000 UTC.

import { db } from "@/lib/db";
import { loadConfig } from "@/lib/config";
import { SEASON_COMPETITIVE_DAYS, SEASON_TOTAL_DAYS } from "@/lib/types";

export const DAY_MS = 24 * 60 * 60 * 1000;

export async function getWorldEpochMs(): Promise<number> {
  const row = await db.systemState.findUnique({ where: { key: "world.epoch.utc" } });
  if (row) return new Date(row.value).getTime();
  const cfg = await loadConfig();
  const fromCfg = cfg.get("world.epoch.utc");
  if (fromCfg) return new Date(fromCfg).getTime();
  // Fallback: start of today UTC
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function gameDayFrom(epochMs: number, at: Date = new Date()): number {
  return 1 + Math.floor((at.getTime() - epochMs) / DAY_MS);
}

export async function currentGameDay(): Promise<number> {
  const epoch = await getWorldEpochMs();
  return gameDayFrom(epoch, new Date());
}

export function dayStartUtcMs(epochMs: number, gameDay: number): number {
  return epochMs + (gameDay - 1) * DAY_MS;
}

export interface SeasonInfo {
  id: string;
  number: number;
  seasonDay: number; // 1..37
  phase: "COMPETITIVE" | "PRESEASON";
  startEpochDay: number;
  state: string;
}

export async function resolveSeason(gameDay: number): Promise<SeasonInfo | null> {
  const seasons = await db.season.findMany({ orderBy: { number: "asc" } });
  if (seasons.length === 0) return null;
  // Find the latest season whose start <= gameDay. When NONE has started yet
  // (the mandatory ≥5-day pre-season window right after a world reset) there is
  // no active season: the world exists, Season 1 is scheduled but not begun.
  let active: (typeof seasons)[number] | null = null;
  for (const s of seasons) {
    if (gameDay >= s.startEpochDay) active = s;
  }
  if (!active) return null;
  const seasonDay = Math.min(gameDay - active.startEpochDay + 1, SEASON_TOTAL_DAYS);
  return {
    id: active.id,
    number: active.number,
    seasonDay,
    phase: seasonDay <= SEASON_COMPETITIVE_DAYS ? "COMPETITIVE" : "PRESEASON",
    startEpochDay: active.startEpochDay,
    state: active.state,
  };
}

/**
 * Earliest season that has NOT started yet (startEpochDay > gameDay) — the
 * countdown target for the post-reset pre-season window ("Season 1 begins in
 * N days"). Returns null when every existing season is already running/past.
 */
export async function upcomingSeason(gameDay: number): Promise<{ id: string; number: number; startEpochDay: number } | null> {
  const next = await db.season.findFirst({
    where: { startEpochDay: { gt: gameDay } },
    orderBy: { number: "asc" },
    select: { id: true, number: true, startEpochDay: true },
  });
  return next;
}

export async function seasonDayFor(gameDay: number): Promise<{ season: SeasonInfo | null }> {
  return { season: await resolveSeason(gameDay) };
}

/** Absolute game day of the CURRENT season's last day (1..SEASON_TOTAL_DAYS). */
export async function seasonEndDay(): Promise<number | null> {
  const gameDay = await currentGameDay();
  const season = await resolveSeason(gameDay);
  if (!season) return null;
  return season.startEpochDay + SEASON_TOTAL_DAYS - 1;
}

/**
 * Remaining days of the current season INCLUDING today (user mandate Task 23-f:
 * "una cesión siempre será por el resto de días que quede de la temporada").
 * Returns null when the world has no active season yet.
 */
export async function remainingSeasonDays(): Promise<number | null> {
  const end = await seasonEndDay();
  if (end === null) return null;
  const gameDay = await currentGameDay();
  return Math.max(1, end - gameDay + 1);
}
