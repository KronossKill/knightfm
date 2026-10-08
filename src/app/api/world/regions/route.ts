// GET /api/world/regions — public world atlas: regions with ordered divisions.

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const regions = await db.region.findMany({
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      nameKey: true,
      divisions: { orderBy: { index: "asc" }, select: { id: true, index: true } },
      _count: { select: { clubs: true } },
    },
  });

  return ok({
    regions: regions.map((r) => ({
      id: r.id,
      index: r.index,
      nameKey: r.nameKey,
      clubCount: r._count.clubs,
      divisions: r.divisions.map((d) => ({ id: d.id, index: d.index })),
    })),
  });
}
