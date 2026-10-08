// GET /api/world/state — public world snapshot (no auth).
// Opportunistically drives the durable catch-up scheduler (D-002): the call is
// fire-and-forget and must NEVER block or fail the response.

import { NextRequest } from "next/server";
import { ok, rateLimit, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { getBool, getConfig, getInt } from "@/lib/config";
import { getKnightUsd } from "@/lib/engine/knight-usd";
import { currentGameDay, resolveSeason, upcomingSeason } from "@/lib/engine/clock";
import { SEASON_COMPETITIVE_DAYS, SEASON_TOTAL_DAYS } from "@/lib/types";
import { processDueJobs } from "@/lib/engine/scheduler";

export const dynamic = "force-dynamic";

const PRESENCE_WINDOW_MS = 5 * 60 * 1000; // D-009: 5-minute online window

export async function GET(req: NextRequest) {
  // Fire-and-forget scheduler tick (catch-up pattern). Errors are swallowed:
  // the JobRun ledger makes every job idempotent and replayable.
  // SECURITY (pentest fix — anonymous engine abuse): this endpoint is public,
  // and every call used to drive the simulation engine. Anyone (or a simple
  // for-loop) could spin the world clock. The trigger is now per-IP throttled
  // (once per 30s is far more than any real client needs — the first call
  // runs the full catch-up; later calls are no-ops while it is in flight).
  try {
    const rl = rateLimit(`wstate-engine:${clientIp(req)}`, 2, 30_000);
    if (rl.allowed) void processDueJobs().catch(() => undefined);
  } catch {
    // never break world state because of the scheduler
  }

  const now = new Date();
  const gameDay = await currentGameDay();
  const season = await resolveSeason(gameDay);

  const seasonInfo = season
    ? {
        number: season.number,
        state: season.state,
        ...(season.phase === "PRESEASON"
          ? { preseasonDay: Math.max(1, season.seasonDay - SEASON_COMPETITIVE_DAYS) }
          : { seasonDay: Math.min(season.seasonDay, SEASON_COMPETITIVE_DAYS) }),
        startEpochDay: season.startEpochDay,
        endEpochDay: season.startEpochDay + SEASON_TOTAL_DAYS - 1,
      }
    : null;

  // Post-reset pre-season: no season is running yet — expose the UPCOMING one
  // so clients can show the honest countdown ("Season 1 begins in N days").
  // startsInDays counts TODAY as day 1 of the wait (1 = kicks off tomorrow's
  // rollover… the season's day 1 arrives when gameDay reaches startEpochDay).
  const nextSeason = season ? null : await upcomingSeason(gameDay);
  const nextSeasonInfo = nextSeason
    ? {
        number: nextSeason.number,
        startEpochDay: nextSeason.startEpochDay,
        startsInDays: Math.max(1, nextSeason.startEpochDay - gameDay),
      }
    : null;

  const [maintenanceEnabled, maintenanceMessage, kickoffHour] = await Promise.all([
    getBool("ops.maintenanceMode"),
    getConfig("ops.maintenanceMessage"),
    getInt("competition.kickoffHourUtc", 19),
  ]);

  // Next default kickoff boundary (configurable hour, UTC only).
  const nextKickoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), kickoffHour, 0, 0, 0)
  );
  if (nextKickoff.getTime() <= now.getTime()) nextKickoff.setUTCDate(nextKickoff.getUTCDate() + 1);

  let presenceOnline = 0;
  try {
    presenceOnline = await db.presence.count({
      where: { lastSeenAt: { gt: new Date(now.getTime() - PRESENCE_WINDOW_MS) } },
    });
  } catch {
    presenceOnline = 0; // graceful when presence table is empty/unavailable
  }

  // Effective $Knight→USD rate (detected price source first, manual config second).
  // null → clients hide every USD equivalent (honest: never fabricate a rate).
  let knightUsd: { cents: number; source: "oracle" | "manual" } | null = null;
  try {
    const usd = await getKnightUsd();
    if (usd.cents != null && usd.source != null) knightUsd = { cents: usd.cents, source: usd.source };
  } catch {
    knightUsd = null; // graceful: config/price-source problems never break world state
  }

  return ok({
    gameDay,
    utcNow: now.toISOString(),
    season: seasonInfo,
    nextSeason: nextSeasonInfo,
    maintenance: { enabled: maintenanceEnabled, message: maintenanceMessage },
    nextKickoffUtc: nextKickoff.toISOString(),
    presenceOnline,
    knightUsd,
  });
}
