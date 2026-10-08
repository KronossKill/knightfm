// Knight FM — Create a DIRECT listing (club OWNER or its MANAGER; price floor enforced).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { getClubAccess, squadManagementError } from "../../../_lib/club-access";

const Body = z.object({
  playerId: z.string().min(10).max(64),
  price: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson(req);
  const parsed = Body.safeParse(body);
  if (!parsed.success) return fail("BAD_REQUEST", "playerId and integer price are required", 400);
  const { playerId, price } = parsed.data;

  const player = await db.player.findUnique({ where: { id: playerId }, select: { id: true, clubId: true, retired: true, marketValue: true, loanedUntilDay: true } });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot be listed", 409);
  if (!player.clubId) return fail("PLAYER_NOT_OWNED", "Player is not owned by a club", 409);
  if (player.loanedUntilDay) return fail("PLAYER_ON_LOAN", "The player is currently on loan at another club", 409);
  const access = await getClubAccess(auth.userId, player.clubId);
  const guard = squadManagementError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  // Floor: price ≥ ceil(marketValue × market.directSaleFloorPct / 100)
  const floorPct = await getInt("market.directSaleFloorPct", 100);
  const floor = Math.ceil((player.marketValue * floorPct) / 100);
  if (price < floor) {
    return fail("BELOW_FLOOR", `Price ${price} is below the market floor ${floor} (${floorPct}% of market value)`, 400, { floor });
  }

  const existing = await db.listing.findFirst({
    where: { playerId, state: "OPEN", type: { in: ["DIRECT", "AUCTION", "LOAN"] } },
    select: { id: true, type: true },
  });
  if (existing) return fail("ALREADY_LISTED", `Player already has an open ${existing.type} listing`, 409);

  const listing = await db.listing.create({
    data: {
      type: "DIRECT",
      playerId,
      clubId: player.clubId, // seller club snapshot, used for staleness checks
      sellerId: auth.userId,
      price,
      floor,
      state: "OPEN",
    },
  });

  await audit("LISTING_CREATED", auth.userId, { listingId: listing.id, playerId, type: "DIRECT", price, floor });
  return ok({ listing: { id: listing.id, type: listing.type, price: listing.price, floor: listing.floor, state: listing.state } });
}
