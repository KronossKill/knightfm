// POST /api/competitions/friendly — schedule a friendly (20 $Knight fee).
// Validations: future kickoff, distinct clubs, both clubs free on that UTC day,
// max 2 friendlies per club per 7 days, honest 402 when the treasury is short.
// The scheduler simulates the fixture at kickoff (MATCH job).

import { NextRequest } from "next/server";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { DAY_MS, gameDayFrom, getWorldEpochMs } from "@/lib/engine/clock";
import { debitClub, FinanceError } from "@/lib/engine/finance";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

interface FriendlyBody {
  clubId?: string;
  opponentClubId?: string;
  kickoffUtc?: string;
}

const FRIENDLY_WINDOW_DAYS = 7;
const MAX_FRIENDLIES_PER_WINDOW = 2;

function utcDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<FriendlyBody>(req);
  if (!body?.clubId || !body.opponentClubId || !body.kickoffUtc) {
    return fail("VALIDATION_ERROR", "clubId, opponentClubId and kickoffUtc are required", 400);
  }
  const { clubId, opponentClubId } = body;
  const kickoff = new Date(body.kickoffUtc);
  if (!Number.isFinite(kickoff.getTime())) {
    return fail("VALIDATION_ERROR", "kickoffUtc must be a valid ISO UTC datetime", 400);
  }

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  if (clubId === opponentClubId) return fail("INVALID_OPPONENT", "A club cannot play itself", 400);

  const opponent = await db.club.findUnique({
    where: { id: opponentClubId },
    select: { id: true, name: true },
  });
  if (!opponent) return fail("CLUB_NOT_FOUND", "Opponent club not found", 404);

  const now = new Date();
  if (kickoff.getTime() <= now.getTime()) {
    return fail("KICKOFF_IN_PAST", "kickoffUtc must be in the future", 400);
  }

  const season = await getActiveSeason();
  if (!season) return fail("NO_ACTIVE_SEASON", "No active season to schedule friendlies in", 400);

  const fee = await getInt("competition.friendlyFee", 20);

  // Config limit: max 2 friendlies per club per 7 days (both clubs checked).
  const windowStart = new Date(now.getTime() - FRIENDLY_WINDOW_DAYS * DAY_MS);
  for (const cid of [clubId, opponentClubId]) {
    const recent = await db.fixture.count({
      where: {
        competition: "FRIENDLY",
        kickoffAt: { gte: windowStart },
        OR: [{ homeId: cid }, { awayId: cid }],
      },
    });
    if (recent >= MAX_FRIENDLIES_PER_WINDOW) {
      return fail("FRIENDLY_LIMIT", `Club already has ${MAX_FRIENDLIES_PER_WINDOW} friendlies in the last ${FRIENDLY_WINDOW_DAYS} days`, 400);
    }
  }

  // Availability: no other fixture on the same UTC day for either club.
  const bounds = utcDayBounds(kickoff);
  const clash = await db.fixture.count({
    where: {
      status: { not: "CANCELLED" },
      kickoffAt: { gte: bounds.start, lt: bounds.end },
      OR: [
        { homeId: { in: [clubId, opponentClubId] } },
        { awayId: { in: [clubId, opponentClubId] } },
      ],
    },
  });
  if (clash > 0) {
    return fail("CLUB_UNAVAILABLE", "One of the clubs already has a fixture on that day", 409);
  }

  // Idempotent replay guard for the exact same scheduling intent.
  const idemKey = `FRIENDLY:${clubId}:${opponentClubId}:${kickoff.toISOString()}`;
  const existing = await db.ledgerEntry.findUnique({ where: { idemKey }, select: { id: true } });
  if (existing) {
    return fail("ALREADY_SCHEDULED", "This exact friendly was already scheduled", 409);
  }

  // Season match day for the kickoff's game day.
  const epochMs = await getWorldEpochMs();
  const kickoffGameDay = gameDayFrom(epochMs, kickoff);
  const matchDay = Math.min(SEASON_TOTAL_DAYS, Math.max(1, kickoffGameDay - season.startEpochDay + 1));

  try {
    await db.$transaction(async (tx) => {
      await debitClub(tx, clubId, fee, "FRIENDLY_FEE", idemKey, `Friendly vs ${opponent.name}`);
      await tx.fixture.create({
        data: {
          seasonId: season.id,
          competition: "FRIENDLY",
          matchDay,
          kickoffAt: kickoff,
          homeId: clubId,
          awayId: opponentClubId,
          status: "SCHEDULED",
        },
      });
    });
  } catch (e) {
    if (e instanceof FinanceError) return fail(e.code, e.message, 402);
    throw e;
  }

  await audit("FRIENDLY_SCHEDULED", auth.userId, {
    clubId,
    opponentClubId,
    kickoffUtc: kickoff.toISOString(),
    fee,
    matchDay,
  });

  return ok({
    scheduled: true,
    competition: "FRIENDLY",
    homeId: clubId,
    awayId: opponentClubId,
    opponentName: opponent.name,
    kickoffUtc: kickoff.toISOString(),
    fee,
    matchDay,
  });
}
