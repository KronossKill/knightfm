// Knight FM — Markets hub: active DIRECT listings (spec §13, §25). Public.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { playerCard, parsePage } from "../../_lib/markets-lib";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { page, size, skip } = parsePage(url);

  const position = url.searchParams.get("position");
  const maxValueRaw = url.searchParams.get("maxValue");
  const maxValue = maxValueRaw !== null && Number.isFinite(parseInt(maxValueRaw, 10)) ? parseInt(maxValueRaw, 10) : null;

  const where = {
    type: "DIRECT" as const,
    state: "OPEN" as const,
    ...(position ? { player: { position, retired: false } } : {}),
    ...(maxValue !== null ? { price: { lte: maxValue } } : {}),
  };

  const [total, rows] = await Promise.all([
    db.listing.count({ where }),
    db.listing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: {
        player: { select: { id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true, age: true, marketValue: true } },
        club: { select: { id: true, name: true } }, // seller club (set at listing creation)
      },
    }),
  ]);

  return ok({
    items: rows.map((l) => ({
      listingId: l.id,
      player: l.player ? playerCard(l.player) : null,
      price: l.price,
      floor: l.floor,
      sellerClub: l.club ? { id: l.club.id, name: l.club.name } : null,
      createdAt: l.createdAt,
    })),
    page,
    pages: Math.max(1, Math.ceil(total / size)),
    total,
  });
}
