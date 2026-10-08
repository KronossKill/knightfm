// Knight FM — GET /api/onboarding/clubs?path=MANAGER|OWNER&regionIndex=&q=&page=
// Lists available system-owned clubs for the chosen career path:
//   MANAGER → system clubs without a manager (with squad metrics for the preview).
//   OWNER   → system clubs purchasable at economy.systemClubPrice.
// Task 30: only divisions with index >= world.pickMinDivisionIndex (default 5) are
// selectable — top divisions are protected so users cannot simply pick the clubs at
// the top of the pyramid. Applies to BOTH paths (first pick, manager re-pick after
// abandoning a club, owner buying additional clubs). The response carries
// minDivisionIndex so the UI can explain the rule.
// Paginated (24/page) with total count. Server-authoritative data only.

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";

export const runtime = "nodejs";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const url = new URL(req.url);
  const path = url.searchParams.get("path") === "OWNER" ? "OWNER" : "MANAGER";

  const regionIndexRaw = url.searchParams.get("regionIndex");
  const regionIndex = regionIndexRaw ? Number.parseInt(regionIndexRaw, 10) : NaN;

  const qRaw = (url.searchParams.get("q") ?? "").trim().slice(0, 60);
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, 10000) : 1;

  const minDivisionIndex = await getInt("world.pickMinDivisionIndex", 5);

  const where = {
    systemOwned: true,
    division: { index: { gte: minDivisionIndex } },
    ...(path === "MANAGER" ? { managerId: null } : {}),
    ...(Number.isFinite(regionIndex) ? { region: { index: regionIndex } } : {}),
    ...(qRaw ? { name: { contains: qRaw } } : {}),
  };

  const [total, clubs] = await Promise.all([
    db.club.count({ where }),
    db.club.findMany({
      where,
      select: {
        id: true,
        name: true,
        operatingFund: true,
        brand: { select: { primaryColor: true, secondaryColor: true, badgeShape: true, initials: true } },
        region: { select: { index: true, nameKey: true } },
        division: { select: { index: true } },
        players: { where: { retired: false, isYouth: false }, select: { ovr: true } },
        _count: { select: { facilities: true, players: { where: { retired: false, isYouth: false } } } },
      },
      orderBy: [{ region: { index: "asc" } }, { division: { index: "asc" } }, { name: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const price = path === "OWNER" ? await getInt("economy.systemClubPrice", 100) : null;

  return ok({
    total,
    page,
    pageSize: PAGE_SIZE,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    price,
    minDivisionIndex,
    clubs: clubs.map((c) => {
      const squadSize = c._count.players;
      const avgOvr =
        squadSize > 0 ? Math.round(c.players.reduce((acc, p) => acc + p.ovr, 0) / squadSize) : null;
      return {
        id: c.id,
        name: c.name,
        brand: c.brand
          ? {
              primaryColor: c.brand.primaryColor,
              secondaryColor: c.brand.secondaryColor,
              badgeShape: c.brand.badgeShape,
              initials: c.brand.initials,
            }
          : null,
        regionIndex: c.region.index,
        regionNameKey: c.region.nameKey,
        divisionIndex: c.division.index,
        squadSize,
        avgOvr,
        facilitiesCount: c._count.facilities,
        operatingFund: c.operatingFund,
        price,
      };
    }),
  });
}
