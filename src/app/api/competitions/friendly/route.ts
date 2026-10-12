// Knight FM — friendly matches (user mandate).
//
// GET /api/competitions/friendly?clubId=… — planner payload for the scheduling
// UI: current fee, the enforced buffer window and the eligible opponents.
//
// POST /api/competitions/friendly — schedule a friendly (competition.friendlyFee,
// default 20 $Knight, charged to the HOME club). A friendly is a TACTICS-TESTING
// tool: the engine pays NO prize, NO matchday revenue and NO gate receipts for
// it, but it DOES consume real player energy/fatigue.
//
// Validations: future kickoff, distinct existing clubs, both clubs free within
// the configured buffer (competition.friendlyBufferMin, default 30 minutes) —
// the kickoff must sit at least that many minutes BEFORE and AFTER any other
// fixture (official or friendly) of BOTH participating clubs, max 2 friendlies
// per club per 7 days, honest 402 when the treasury is short. The scheduler
// simulates the fixture at kickoff (MATCH job).

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

const brandSelect = { select: { initials: true, primaryColor: true, secondaryColor: true } };

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const [fee, bufferMin] = await Promise.all([
    getInt("competition.friendlyFee", 20),
    getInt("competition.friendlyBufferMin", 30),
  ]);

  const opponents = await db.club.findMany({
    where: { id: { not: clubId } },
    select: { id: true, name: true, brand: brandSelect },
    orderBy: { name: "asc" },
  });

  // Server clock so the planner can floor the date input without trusting the
  // client's (possibly skewed) clock.
  return ok({ fee, bufferMin, opponents, serverTimeUtc: new Date().toISOString() });
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

  const [fee, bufferMin] = await Promise.all([
    getInt("competition.friendlyFee", 20),
    getInt("competition.friendlyBufferMin", 30),
  ]);

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

  // Buffer rule (user mandate): the friendly kickoff must sit at least
  // competition.friendlyBufferMin minutes BEFORE and AFTER any other fixture —
  // official OR friendly — of BOTH participating clubs. Same-day scheduling is
  // allowed as long as this buffer is respected; with bufferMin = 0 only an
  // exact overlap is rejected.
  const padMs = Math.max(0, bufferMin) * 60_000;
  const kickoffFilter =
    padMs > 0
      ? { gt: new Date(kickoff.getTime() - padMs), lt: new Date(kickoff.getTime() + padMs) }
      : { equals: kickoff };
  const clash = await db.fixture.count({
    where: {
      status: { not: "CANCELLED" },
      kickoffAt: kickoffFilter,
      OR: [
        { homeId: { in: [clubId, opponentClubId] } },
        { awayId: { in: [clubId, opponentClubId] } },
      ],
    },
  });
  if (clash > 0) {
    return fail("TOO_CLOSE_TO_MATCH", `A friendly must be at least ${bufferMin} minutes away from any other match of both clubs`, 409);
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
