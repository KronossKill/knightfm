// Knight FM — Create an AUCTION listing (club OWNER or its MANAGER; auction floor enforced).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { getClubAccess, squadManagementError } from "../../../_lib/club-access";

const Body = z.object({
  playerId: z.string().min(10).max(64),
  startPrice: z.number().int().positive(),
  hours: z.union([z.literal(24), z.literal(48), z.literal(72)]),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return fail("BAD_REQUEST", "playerId, integer startPrice and hours (24|48|72) are required", 400);
  const { playerId, startPrice, hours } = parsed.data;

  const player = await db.player.findUnique({ where: { id: playerId }, select: { clubId: true, retired: true, marketValue: true, loanedUntilDay: true } });
  if (!player) return fail("PLAYER_NOT_FOUND", "Player not found", 404);
  if (player.retired) return fail("PLAYER_RETIRED", "Retired players cannot be auctioned", 409);
  if (!player.clubId) return fail("PLAYER_NOT_OWNED", "Player is not owned by a club", 409);
  if (player.loanedUntilDay) return fail("PLAYER_ON_LOAN", "The player is currently on loan at another club", 409);
  const access = await getClubAccess(auth.userId, player.clubId);
  const guard = squadManagementError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  // Auction floor: startPrice ≥ ceil(marketValue × market.auctionFloorPct / 100) — default 20%.
  const floorPct = await getInt("market.auctionFloorPct", 20);
  const floor = Math.ceil((player.marketValue * floorPct) / 100);
  if (startPrice < floor) {
    return fail("BELOW_FLOOR", `Start price ${startPrice} is below the auction floor ${floor} (${floorPct}% of market value)`, 400, { floor });
  }

  const existing = await db.listing.findFirst({
    where: { playerId, state: "OPEN", type: { in: ["DIRECT", "AUCTION", "LOAN"] } },
    select: { id: true, type: true },
  });
  if (existing) return fail("ALREADY_LISTED", `Player already has an open ${existing.type} listing`, 409);

  const expiresAt = new Date(Date.now() + hours * 3600_000);
  const listing = await db.listing.create({
    data: {
      type: "AUCTION",
      playerId,
      clubId: player.clubId,
      sellerId: auth.userId,
      price: startPrice,
      floor,
      state: "OPEN",
      expiresAt,
    },
  });

  await audit("AUCTION_CREATED", auth.userId, { listingId: listing.id, playerId, startPrice, hours, expiresAt });
  return ok({ listing: { id: listing.id, type: "AUCTION", startPrice, floor, expiresAt, state: "OPEN" } });
}
