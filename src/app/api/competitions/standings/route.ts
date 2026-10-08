// GET /api/competitions/standings?divisionId= — public league table for the
// active season (points desc, goal difference desc, goals for desc, name asc).

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { getActiveSeason } from "@/app/api/_lib/active-season";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const divisionId = req.nextUrl.searchParams.get("divisionId");
  if (!divisionId) return fail("VALIDATION_ERROR", "divisionId query parameter is required", 400);

  const division = await db.division.findUnique({
    where: { id: divisionId },
    include: { region: { select: { id: true, index: true, nameKey: true } } },
  });
  if (!division) return fail("DIVISION_NOT_FOUND", "Division not found", 404);

  const season = await getActiveSeason();
  if (!season) return ok({ season: null, division: null, standings: [] });

  // Promotion / relegation / World Cup zones for THIS division (Task 22):
  // the UI renders its badges from these server values so the table can never
  // disagree with the season-transition engine.
  const [maxIndexRow, promotionSlots, relegationSlots, worldCupSlots] = await Promise.all([
    db.division.aggregate({ where: { regionId: division.regionId }, _max: { index: true } }),
    getInt("competition.promotionSlots", 3),
    getInt("competition.relegationSlots", 3),
    getInt("competition.worldCupSlots", 3),
  ]);
  const isLastDivision = division.index >= (maxIndexRow._max.index ?? division.index);

  const rows = await db.standing.findMany({
    where: { seasonId: season.id, divisionId },
    include: {
      club: {
        select: {
          id: true,
          name: true,
          brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
        },
      },
    },
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.club.name.localeCompare(b.club.name)
  );

  return ok({
    season: { id: season.id, number: season.number },
    division: {
      id: division.id,
      index: division.index,
      region: { id: division.region.id, index: division.region.index, nameKey: division.region.nameKey },
    },
    zones: { promotionSlots, relegationSlots, worldCupSlots, isLastDivision },
    standings: rows.map((r, i) => ({
      position: i + 1,
      club: {
        id: r.club.id,
        name: r.club.name,
        brand: r.club.brand,
      },
      played: r.played,
      won: r.won,
      drawn: r.drawn,
      lost: r.lost,
      gf: r.gf,
      ga: r.ga,
      gd: r.gf - r.ga,
      points: r.points,
    })),
  });
}
