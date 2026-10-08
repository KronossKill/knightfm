// Knight FM — Open LOAN listings across the market (public read).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const listings = await db.listing.findMany({
    where: { type: "LOAN", state: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const items = await Promise.all(
    listings.map(async (l) => {
      const player = l.playerId
        ? await db.player.findUnique({
            where: { id: l.playerId },
            select: { id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true, age: true, marketValue: true },
          })
        : null;
      const club = l.clubId
        ? await db.club.findUnique({ where: { id: l.clubId }, select: { id: true, name: true } })
        : null;
      return {
        id: l.id,
        price: l.price,
        durationDays: l.duration ?? 7,
        createdAt: l.createdAt.toISOString(),
        player: player
          ? {
              id: player.id,
              name: `${player.firstName} ${player.lastName}`,
              position: player.position,
              ovr: player.ovr,
              stars: player.stars,
              age: player.age,
              marketValue: player.marketValue,
            }
          : null,
        originClub: club ? { id: club.id, name: club.name } : null,
      };
    })
  );

  return ok({ items: items.filter((i) => i.player), total: items.length });
}
