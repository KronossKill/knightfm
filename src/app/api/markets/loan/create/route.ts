// Knight FM — Create a LOAN listing (club OWNER or its MANAGER). A loaned player stays the
// property of the origin club: the borrower pays the loan fee, registers the player until
// `loanedUntilDay` and the scheduler returns him automatically.
// User mandate (Task 23-f): a loan ALWAYS runs for the REST of the current season —
// the client cannot choose a duration anymore.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { remainingSeasonDays } from "@/lib/engine/clock";
import { getClubAccess, squadManagementError } from "../../../_lib/club-access";

const Body = z.object({
  playerId: z.string().min(10).max(64),
  price: z.number().int().min(0),
  // Deprecated (Task 23-f): kept optional for backward compatibility, IGNORED —
  // the duration is always the remaining days of the current season.
  durationDays: z.number().int().positive().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) {
    return fail("BAD_REQUEST", "playerId and integer price ≥ 0 are required", 400);
  }
  const { playerId, price } = parsed.data;

  // User mandate (Task 23-f): the loan lasts the remaining days of the season.
  const remaining = await remainingSeasonDays();
  if (remaining === null) {
    return fail("NO_SEASON", "Loans require an active season", 409);
  }

  const player = await db.player.findUnique({
    where: { id: playerId },
    select: { id: true, clubId: true, retired: true, isFreeAgent: true, isYouth: true, loanedUntilDay: true, marketValue: true },
  });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot be loaned out", 409);
  if (!player.clubId || player.isFreeAgent) return fail("PLAYER_NOT_OWNED", "Player is not owned by a club", 409);
  if (player.isYouth) return fail("PLAYER_NOT_OWNED", "Youth prospects cannot be loaned out", 409);
  if (player.loanedUntilDay) return fail("PLAYER_ON_LOAN", "The player is currently on loan at another club", 409);
  const access = await getClubAccess(auth.userId, player.clubId);
  const guard = squadManagementError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const existing = await db.listing.findFirst({
    where: { playerId, state: "OPEN", type: { in: ["DIRECT", "AUCTION", "LOAN"] } },
    select: { id: true, type: true },
  });
  if (existing) return fail("ALREADY_LISTED", `Player already has an open ${existing.type} listing`, 409);

  const listing = await db.listing.create({
    data: {
      type: "LOAN",
      playerId,
      clubId: player.clubId, // origin club snapshot, used for staleness checks
      sellerId: auth.userId,
      price,
      duration: remaining, // rest of the season (Task 23-f)
      floor: 0,
      state: "OPEN",
    },
  });

  await audit("LOAN_LISTED", auth.userId, { listingId: listing.id, playerId, price, durationDays: remaining, untilSeasonEnd: true });
  return ok({ listing: { id: listing.id, type: listing.type, price: listing.price, durationDays: listing.duration, state: listing.state } });
}
