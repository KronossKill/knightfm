// Knight FM — GET /api/search?q= (Task 32 — Master UI/UX command palette).
// Global entity search for the Ctrl+K palette: world-wide players and clubs.
// Authenticated; matches are case-insensitive substrings; hard limits keep the
// response small (palette debounce, no pagination by design).

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const LIMIT = 6;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 40) {
    return fail("VALIDATION_ERROR", "q must be 2..40 characters", 400);
  }

  const [players, clubs] = await Promise.all([
    db.player.findMany({
      where: {
        clubId: { not: null },
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        detailedPos: true,
        ovr: true,
        age: true,
        club: { select: { id: true, name: true, brand: { select: { initials: true, primaryColor: true, secondaryColor: true } } } },
      },
      orderBy: { ovr: "desc" },
      take: LIMIT,
    }),
    db.club.findMany({
      where: { name: { contains: q } },
      select: {
        id: true,
        name: true,
        systemOwned: true,
        division: { select: { index: true } },
        region: { select: { nameKey: true, index: true } },
        brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
      },
      orderBy: [{ division: { index: "asc" } }, { name: "asc" }],
      take: LIMIT,
    }),
  ]);

  return ok({
    players: players.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`.trim(),
      position: p.position,
      detailedPos: p.detailedPos,
      ovr: p.ovr,
      age: p.age,
      club: p.club ? { id: p.club.id, name: p.club.name, brand: p.club.brand } : null,
    })),
    clubs: clubs.map((c) => ({
      id: c.id,
      name: c.name,
      systemOwned: c.systemOwned,
      divisionIndex: c.division.index,
      regionNameKey: c.region.nameKey,
      brand: c.brand,
    })),
  });
}
