// GET /api/club/[id] — public club profile (scouting limits apply to players).
// Task 26: returns the FULL rival squad (name/pos/ovr/stars/age + market value
// and release clause) so a manager can decide to exercise a rescission clause,
// plus the club's staff.

import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { FACILITY_TYPES } from "@/lib/types";
import { getInt } from "@/lib/config";
import { starsFor } from "@/lib/staff-quality";
import { getActiveSeason } from "@/app/api/_lib/active-season";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const club = await db.club.findUnique({
    where: { id },
    include: {
      brand: true,
      division: { include: { region: { select: { id: true, nameKey: true, index: true } } } },
      owner: { select: { username: true } },
      manager: { select: { username: true } },
      facilities: { select: { type: true, level: true } },
    },
  });
  if (!club) return fail("CLUB_NOT_FOUND", "Club not found", 404);

  const season = await getActiveSeason();

  // Standings row + position within the division.
  let standings: {
    position: number | null;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
  } | null = null;
  if (season) {
    const row = await db.standing.findFirst({ where: { seasonId: season.id, clubId: id } });
    if (row) {
      const table = await db.standing.findMany({
        where: { seasonId: season.id, divisionId: club.divisionId },
        orderBy: [{ points: "desc" }, { gf: "desc" }, { ga: "asc" }],
        select: { clubId: true },
      });
      const idx = table.findIndex((t) => t.clubId === id);
      standings = {
        position: idx >= 0 ? idx + 1 : null,
        points: row.points,
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        gf: row.gf,
        ga: row.ga,
      };
    }
  }

  // Public top-5 (scouting limits: name, position, ovr, stars ONLY).
  const topPlayers = await db.player.findMany({
    where: { clubId: id, retired: false, isYouth: false, isFreeAgent: false },
    orderBy: { ovr: "desc" },
    take: 5,
    select: { id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true },
  });

  // Task 26: full rival squad — the clause-exercise flow needs the public
  // identity fields PLUS the financial fields (market value, release clause).
  const [squadRaw, staffRaw, clauseMultiplier] = await Promise.all([
    db.player.findMany({
      where: { clubId: id, retired: false, isYouth: false, isFreeAgent: false },
      orderBy: [{ position: "asc" }, { ovr: "desc" }],
      select: {
        id: true, firstName: true, lastName: true, position: true, ovr: true, stars: true,
        age: true, marketValue: true, releaseClause: true, loanedUntilDay: true,
        // Task 27-f: availability status for the rival-squad badges.
        suspension: true, injuredUntil: true,
        // Task 28: season yellow-card accumulator.
        yellowCards: true,
      },
    }),
    db.staffMember.findMany({
      where: { clubId: id },
      orderBy: [{ role: "asc" }, { quality: "desc" }],
      select: { id: true, role: true, name: true, quality: true, specialization: true },
    }),
    getInt("economy.releaseClauseMultiplier", 5),
  ]);
  const squad = squadRaw.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    position: p.position,
    ovr: p.ovr,
    stars: p.stars,
    age: p.age,
    marketValue: p.marketValue,
    releaseClause: p.releaseClause > 0 ? p.releaseClause : p.marketValue * clauseMultiplier,
    onLoan: !!p.loanedUntilDay,
    // Task 27-f: suspension = remaining MATCHES; injuredUntil = UTC ISO | null.
    suspension: p.suspension,
    injuredUntil: p.injuredUntil ? p.injuredUntil.toISOString() : null,
    // Task 28: bookings this season (distinct matches).
    yellowCards: p.yellowCards,
  }));
  const staff = staffRaw.map((s) => ({
    id: s.id,
    role: s.role,
    name: s.name,
    quality: s.quality,
    stars: starsFor(s.quality),
    specialization: s.specialization,
  }));

  // Trophy case: regional cup titles (champion CupRuns). CupRun stores ids only,
  // so season numbers are joined in-query.
  const trophiesRaw = await db.cupRun.findMany({
    where: { clubId: id, champion: true },
    orderBy: [{ seasonId: "asc" }],
  });
  const trophySeasons = await db.season.findMany({
    where: { id: { in: [...new Set(trophiesRaw.map((t) => t.seasonId))] } },
    select: { id: true, number: true },
  });
  const seasonNumberById = new Map(trophySeasons.map((s) => [s.id, s.number]));

  const facilityLevels: Record<string, number> = {};
  for (const type of FACILITY_TYPES) facilityLevels[type] = 1;
  for (const f of club.facilities) facilityLevels[f.type] = f.level;

  return ok({
    club: {
      id: club.id,
      name: club.name,
      systemOwned: club.systemOwned,
      brand: club.brand
        ? {
            primaryColor: club.brand.primaryColor,
            secondaryColor: club.brand.secondaryColor,
            initials: club.brand.initials,
            badgeShape: club.brand.badgeShape,
            crestPattern: club.brand.crestPattern,
          }
        : null,
      region: { id: club.division.region.id, index: club.division.region.index, nameKey: club.division.region.nameKey },
      division: { id: club.divisionId, index: club.division.index },
      owner: club.owner ? { username: club.owner.username } : null,
      manager: club.manager ? { username: club.manager.username } : null,
      facilities: facilityLevels,
      standings,
      season: season ? { id: season.id, number: season.number } : null,
      // Durable record — survives the 2-season detail purge (titles + all-time
      // competitive W/D/L, aggregated at every season transition).
      history: {
        titlesLeague: club.titlesLeague,
        titlesCup: club.titlesCup,
        titlesWorld: club.titlesWorld,
        won: club.histWon,
        drawn: club.histDrawn,
        lost: club.histLost,
      },
    },
    topPlayers,
    squad,
    staff,
    trophies: trophiesRaw.map((t) => ({
      competition: "REGIONAL_CUP" as const,
      seasonNumber: seasonNumberById.get(t.seasonId) ?? null,
      regionId: t.regionId,
    })),
  });
}
