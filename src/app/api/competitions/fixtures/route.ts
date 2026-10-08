// GET /api/competitions/fixtures?clubId=&divisionId=&day=&limit=&competition=
// Public fixture list (SCHEDULED/PLAYED) with club names/brands, competition,
// kickoff (UTC), round, stage and score when played.

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const clubInclude = {
  select: {
    id: true,
    name: true,
    brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
  },
};

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const clubId = sp.get("clubId");
  const divisionId = sp.get("divisionId");
  const dayParam = sp.get("day");
  const competition = sp.get("competition");
  const statusParam = sp.get("status");
  const limitParam = sp.get("limit");
  const limit = Math.max(1, Math.min(200, limitParam ? parseInt(limitParam, 10) || 50 : 50));

  const where: Prisma.FixtureWhereInput = {
    status: { in: ["SCHEDULED", "PLAYED"] },
  };
  if (statusParam === "PLAYED" || statusParam === "SCHEDULED") {
    where.status = statusParam;
  }
  if (clubId) {
    where.OR = [{ homeId: clubId }, { awayId: clubId }];
  }
  if (competition) where.competition = competition;
  if (dayParam !== null) {
    const day = parseInt(dayParam, 10);
    if (Number.isFinite(day)) where.matchDay = day;
  }

  let divisionInfo: { id: string; index: number } | null = null;
  if (divisionId) {
    const clubIds = await db.club.findMany({ where: { divisionId }, select: { id: true } });
    const ids = clubIds.map((c) => c.id);
    where.AND = [{ homeId: { in: ids } }, { awayId: { in: ids } }];
    const division = await db.division.findUnique({ where: { id: divisionId }, select: { id: true, index: true } });
    divisionInfo = division ?? null;
  }

  const fixtures = await db.fixture.findMany({
    where,
    orderBy: dayParam !== null
      ? [{ matchDay: "asc" }, { kickoffAt: "asc" }]
      : [{ kickoffAt: "desc" }, { id: "desc" }],
    take: limit,
    include: {
      home: clubInclude,
      away: clubInclude,
      match: { select: { homeGoals: true, awayGoals: true } },
    },
  });

  return ok({
    filters: { clubId, divisionId: divisionInfo?.id ?? null, day: dayParam ? parseInt(dayParam, 10) : null, competition },
    fixtures: fixtures.map((f) => ({
      id: f.id,
      competition: f.competition,
      round: f.round,
      stage: f.stage,
      regionId: f.regionId,
      matchDay: f.matchDay,
      kickoffUtc: f.kickoffAt.toISOString(),
      status: f.status,
      home: { ...f.home },
      away: { ...f.away },
      score: f.match ? { home: f.match.homeGoals, away: f.match.awayGoals } : null,
    })),
  });
}
