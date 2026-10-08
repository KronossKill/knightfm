// GET /api/competitions/match/[id] — public match detail: score, stats
// (possession/shots/xG), chronologically ordered events and MOTM.

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  // Accept either the Match id or its unique fixtureId (UI naturally holds fixture ids).
  const include = {
    events: {
      orderBy: [{ minute: "asc" }, { type: "asc" }],
      include: { player: { select: { id: true, firstName: true, lastName: true } } },
    },
    fixture: {
      include: {
        season: { select: { number: true } },
        home: {
          select: {
            id: true, name: true,
            brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
          },
        },
        away: {
          select: {
            id: true, name: true,
            brand: { select: { initials: true, primaryColor: true, secondaryColor: true } },
          },
        },
      },
    },
  } satisfies Prisma.MatchInclude;

  // Accept either the Match id or its unique fixtureId (UI naturally holds fixture ids).
  const match = await db.match.findFirst({ where: { OR: [{ fixtureId: id }, { id }] }, include });
  if (!match) return fail("MATCH_NOT_FOUND", "Match not found", 404);

  const motm = match.motmPlayerId
    ? await db.player.findUnique({
        where: { id: match.motmPlayerId },
        select: { id: true, firstName: true, lastName: true },
      })
    : null;

  return ok({
    match: {
      id: match.id,
      fixtureId: match.fixtureId,
      seed: match.seed,
      playedAt: match.playedAt.toISOString(),
      competition: match.fixture.competition,
      round: match.fixture.round,
      stage: match.fixture.stage,
      seasonNumber: match.fixture.season.number,
      kickoffUtc: match.fixture.kickoffAt.toISOString(),
      home: {
        id: match.homeId,
        name: match.fixture.home.name,
        brand: match.fixture.home.brand,
        goals: match.homeGoals,
      },
      away: {
        id: match.awayId,
        name: match.fixture.away.name,
        brand: match.fixture.away.brand,
        goals: match.awayGoals,
      },
      stats: {
        possession: { home: match.possessionHome, away: 100 - match.possessionHome },
        shots: { home: match.shotsHome, away: match.shotsAway },
        xg: { home: match.xgHomeX100 / 100, away: match.xgAwayX100 / 100 },
      },
      motm: motm ? { id: motm.id, name: `${motm.firstName} ${motm.lastName}` } : null,
      events: match.events.map((e) => ({
        minute: e.minute,
        type: e.type,
        clubId: e.clubId,
        playerId: e.playerId,
        playerName: e.player ? `${e.player.firstName} ${e.player.lastName}` : null,
        detail: e.detail,
      })),
    },
  });
}
