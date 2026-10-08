// GET /api/players?clubId= — squad list for club staff (OWNER/MANAGER).
// Includes server-computed per-attribute trend vs latest snapshot (≤14 days).

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";
import { computeTrendMap } from "@/app/api/_lib/player-trend";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const players = await db.player.findMany({
    where: {
      retired: false,
      isYouth: false,
      isFreeAgent: false,
      OR: [{ clubId }, { loanOriginClubId: clubId }], // registered here OR away on loan
    },
    orderBy: [{ ovr: "desc" }, { lastName: "asc" }],
  });

  const list = await Promise.all(
    players.map(async (p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      position: p.position,
      detailedPos: p.detailedPos,
      ovr: p.ovr,
      potential: p.potential,
      stars: p.stars,
      marketValue: p.marketValue,
      salary: p.salary,
      releaseClause: p.releaseClause,
      form: p.form,
      fatigue: p.fatigue,
      sharpness: p.sharpness,
      morale: p.morale,
      confidence: p.confidence,
      injuredUntil: p.injuredUntil ? p.injuredUntil.toISOString() : null,
      suspension: p.suspension,
      yellowCards: p.yellowCards,
      loan:
        p.loanedUntilDay && p.loanOriginClubId === clubId
          ? { status: "OUT" as const, untilDay: p.loanedUntilDay }
          : p.loanedUntilDay && p.loanOriginClubId !== null
            ? { status: "IN" as const, untilDay: p.loanedUntilDay }
            : null,
      trendPerAttribute: await computeTrendMap(p.id, p.attributes),
    }))
  );

  return ok({
    clubId,
    players: list,
    count: list.length,
  });
}
