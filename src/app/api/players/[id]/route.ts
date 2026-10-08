// GET /api/players/[id] — full profile for club staff; limited public view for
// everyone else (scouting limits: name, position, ovr, stars, age ONLY).

import { NextRequest } from "next/server";
import { fail, getAuth, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { getClubAccess } from "@/app/api/_lib/club-access";
import { computeTrendMap } from "@/app/api/_lib/player-trend";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const player = await db.player.findUnique({ where: { id } });
  if (!player || player.retired) return fail("PLAYER_NOT_FOUND", "Player not found", 404);

  const displayName = `${player.firstName} ${player.lastName}`;

  // Staff detection: authenticated user with OWNER/MANAGER access to the player's
  // club — or to the ORIGIN club while the player is away on loan.
  const auth = await getAuth(req);
  let access = auth && player.clubId ? await getClubAccess(auth.userId, player.clubId) : null;
  if ((!access || access.role === "NONE") && auth && player.loanOriginClubId) {
    access = await getClubAccess(auth.userId, player.loanOriginClubId);
  }
  const isStaff = !!access && !!access.club && access.role !== "NONE";

  if (!isStaff) {
    return ok({
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        ovr: player.ovr,
        stars: player.stars,
        age: player.age,
      },
      view: "PUBLIC",
    });
  }

  return ok({
    player: {
      id: player.id,
      clubId: player.clubId,
      firstName: player.firstName,
      lastName: player.lastName,
      age: player.age,
      position: player.position,
      detailedPos: player.detailedPos,
      ovr: player.ovr,
      potential: player.potential,
      stars: player.stars,
      marketValue: player.marketValue,
      salary: player.salary,
      releaseClause: player.releaseClause,
      attributes: JSON.parse(player.attributes || "{}"),
      trendPerAttribute: await computeTrendMap(player.id, player.attributes),
      state: {
        form: player.form,
        fatigue: player.fatigue,
        sharpness: player.sharpness,
        morale: player.morale,
        confidence: player.confidence,
        injuredUntil: player.injuredUntil ? player.injuredUntil.toISOString() : null,
        suspension: player.suspension,
        yellowCards: player.yellowCards,
        isFreeAgent: player.isFreeAgent,
        isYouth: player.isYouth,
        retired: player.retired,
      },
      loan: player.loanedUntilDay
        ? { untilDay: player.loanedUntilDay, originClubId: player.loanOriginClubId }
        : null,
    },
    view: "STAFF",
    displayName,
  });
}
