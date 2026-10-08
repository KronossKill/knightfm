// GET /api/club/mine — clubs where the authenticated user is OWNER or MANAGER,
// with capacity (ICP), standings summary, next fixture and manager contract info.

import { NextRequest } from "next/server";
import { isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { computeCapacity } from "@/lib/engine/capacity";
import { FacilityType } from "@/lib/types";
import { getActiveSeason } from "@/app/api/_lib/active-season";

export const dynamic = "force-dynamic";

const FACILITY_TYPES = ["STADIUM", "TRAINING_CENTER", "YOUTH_ACADEMY", "MEDICAL_CENTER", "SPORTS_SCIENCE"] as const;

function capacityLevels(rows: { type: string; level: number }[]): Record<FacilityType, number> {
  const levels: Record<FacilityType, number> = {
    STADIUM: 1,
    TRAINING_CENTER: 1,
    YOUTH_ACADEMY: 1,
    MEDICAL_CENTER: 1,
    SPORTS_SCIENCE: 1,
    REST_ROOMS: 1,
  };
  for (const f of rows) {
    if ((FACILITY_TYPES as readonly string[]).includes(f.type)) levels[f.type as FacilityType] = f.level;
  }
  return levels;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const [wTraining, wMedical, wYouth, wScience, baseCapacity, maxBonusSlots, season] = await Promise.all([
    getInt("squad.icpTrainingWeight", 30),
    getInt("squad.icpMedicalWeight", 25),
    getInt("squad.icpYouthWeight", 25),
    getInt("squad.icpScienceWeight", 20),
    getInt("squad.baseCapacity", 25),
    getInt("squad.maxBonusSlots", 20),
    getActiveSeason(),
  ]);

  const clubs = await db.club.findMany({
    where: { OR: [{ ownerId: auth.userId }, { managerId: auth.userId }] },
    orderBy: { createdAt: "asc" },
    include: {
      brand: true,
      division: { include: { region: { select: { nameKey: true } } } },
      facilities: { select: { type: true, level: true } },
      _count: {
        select: { players: { where: { retired: false, isYouth: false, isFreeAgent: false } } },
      },
    },
  });

  if (clubs.length === 0) {
    return ok({ clubs: [], season: season ? { id: season.id, number: season.number } : null });
  }

  // Standings position per club (rank within its division for the active season).
  const divisionIds = [...new Set(clubs.map((c) => c.divisionId))];
  const standings = season
    ? await db.standing.findMany({
        where: { seasonId: season.id, divisionId: { in: divisionIds } },
        select: {
          clubId: true, divisionId: true, played: true, won: true,
          drawn: true, lost: true, gf: true, ga: true, points: true,
        },
      })
    : [];
  const divisionTables = new Map<string, typeof standings>();
  for (const row of standings) {
    const list = divisionTables.get(row.divisionId) ?? [];
    list.push(row);
    divisionTables.set(row.divisionId, list);
  }
  const positionByClub = new Map<string, number>();
  for (const list of divisionTables.values()) {
    list.sort(
      (a, b) =>
        b.points - a.points ||
        b.gf - b.ga - (a.gf - a.ga) ||
        b.gf - a.gf ||
        a.clubId.localeCompare(b.clubId)
    );
    list.forEach((row, i) => positionByClub.set(row.clubId, i + 1));
  }
  const standingByClub = new Map(standings.map((s) => [s.clubId, s]));

  // Active manager contracts for this user.
  const contracts = await db.managerContract.findMany({
    where: { managerId: auth.userId, state: "ACTIVE" },
    select: {
      clubId: true, totalAmount: true, durationDays: true,
      dailySalary: true, startDay: true, endDay: true, state: true,
    },
  });
  const contractByClub = new Map(contracts.map((c) => [c.clubId, c]));

  const clubViews: object[] = [];
  for (const club of clubs) {
    const cap = computeCapacity({
      baseCapacity,
      maxBonusSlots,
      levels: capacityLevels(club.facilities),
      weights: { training: wTraining, medical: wMedical, youth: wYouth, science: wScience },
    });

    const standing = standingByClub.get(club.id) ?? null;
    const nextFixture = await db.fixture.findFirst({
      where: { status: "SCHEDULED", OR: [{ homeId: club.id }, { awayId: club.id }] },
      orderBy: { kickoffAt: "asc" },
      include: {
        home: { select: { id: true, name: true } },
        away: { select: { id: true, name: true } },
      },
    });
    const contract = contractByClub.get(club.id) ?? null;

    clubViews.push({
      id: club.id,
      name: club.name,
      originalName: club.originalName,
      nameChangeDay: club.nameChangeDay,
      systemOwned: club.systemOwned,
      role: club.ownerId === auth.userId ? ("OWNER" as const) : ("MANAGER" as const),
      brand: club.brand
        ? {
            primaryColor: club.brand.primaryColor,
            secondaryColor: club.brand.secondaryColor,
            initials: club.brand.initials,
            badgeShape: club.brand.badgeShape,
            crestPattern: club.brand.crestPattern,
          }
        : null,
      regionId: club.regionId,
      regionNameKey: club.division.region.nameKey,
      divisionId: club.divisionId,
      divisionIndex: club.division.index,
      operatingFund: club.operatingFund,
      debt: club.debt,
      finState: club.finState,
      // Secondary market (club resale): current listing state of the club.
      salePrice: club.salePrice,
      saleListedDay: club.saleListedDay,
      capacity: {
        icp: Math.round(cap.icp * 1000) / 1000,
        bonusSlots: cap.bonusSlots,
        baseCapacity,
        finalCapacity: cap.capacity,
      },
      playerCount: club._count.players,
      standings: standing
        ? {
            position: positionByClub.get(club.id) ?? null,
            points: standing.points,
            played: standing.played,
            won: standing.won,
            drawn: standing.drawn,
            lost: standing.lost,
            gf: standing.gf,
            ga: standing.ga,
          }
        : null,
      nextFixture: nextFixture
        ? {
            id: nextFixture.id,
            competition: nextFixture.competition,
            round: nextFixture.round,
            stage: nextFixture.stage,
            kickoffUtc: nextFixture.kickoffAt.toISOString(),
            isHome: nextFixture.homeId === club.id,
            opponentId: nextFixture.homeId === club.id ? nextFixture.away.id : nextFixture.home.id,
            opponentName: nextFixture.homeId === club.id ? nextFixture.away.name : nextFixture.home.name,
          }
        : null,
      contract,
    });
  }

  return ok({ clubs: clubViews, season: season ? { id: season.id, number: season.number } : null });
}
