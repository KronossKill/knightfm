// Knight FM — Markets hub: free agents list (public). Position / OVR filters + pagination.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";
import { playerCard, parsePage } from "../../_lib/markets-lib";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const { page, size, skip } = parsePage(url);

  const position = url.searchParams.get("position");
  const minOvrRaw = url.searchParams.get("minOvr");
  const maxOvrRaw = url.searchParams.get("maxOvr");
  const minOvr = minOvrRaw !== null && Number.isFinite(parseInt(minOvrRaw, 10)) ? parseInt(minOvrRaw, 10) : null;
  const maxOvr = maxOvrRaw !== null && Number.isFinite(parseInt(maxOvrRaw, 10)) ? parseInt(maxOvrRaw, 10) : null;

  const where = {
    isFreeAgent: true,
    retired: false,
    ...(position ? { position } : {}),
    ...(minOvr !== null || maxOvr !== null
      ? { ovr: { ...(minOvr !== null ? { gte: minOvr } : {}), ...(maxOvr !== null ? { lte: maxOvr } : {}) } }
      : {}),
  };

  const [total, rows] = await Promise.all([
    db.player.count({ where }),
    db.player.findMany({
      where,
      orderBy: { ovr: "desc" },
      skip,
      take: size,
      select: { id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true, age: true, marketValue: true },
    }),
  ]);

  return ok({
    items: rows.map(playerCard),
    page,
    pages: Math.max(1, Math.ceil(total / size)),
    total,
  });
}
