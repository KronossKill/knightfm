// Knight FM — Markets hub: active AUCTIONS. Lazily closes due auctions first (public).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { closeDueAuctions, playerCard } from "../../_lib/markets-lib";

export async function GET() {
  // Lazy close: expired auctions settle before they are displayed.
  const closed = await closeDueAuctions();

  const rows = await db.listing.findMany({
    where: { type: "AUCTION", state: "OPEN" },
    orderBy: { expiresAt: "asc" },
    take: 60,
    include: {
      player: { select: { id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true, age: true, marketValue: true } },
      club: { select: { id: true, name: true } },
    },
  });

  const items: Array<Record<string, unknown>> = [];
  for (const l of rows) {
    const highest = await db.bid.findFirst({ where: { auctionId: l.id }, orderBy: { amount: "desc" }, select: { amount: true, clubId: true } });
    const bidCount = await db.bid.count({ where: { auctionId: l.id } });
    items.push({
      listingId: l.id,
      player: l.player ? playerCard(l.player) : null,
      startPrice: l.price,
      floor: l.floor,
      currentHighest: highest?.amount ?? null,
      leaderClubId: highest?.clubId ?? null,
      bidCount,
      sellerClub: l.club ? { id: l.club.id, name: l.club.name } : null,
      expiresAt: l.expiresAt,
      createdAt: l.createdAt,
    });
  }

  return ok({ items, closed: closed.closed, settled: closed.sold });
}
