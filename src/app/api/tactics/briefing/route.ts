// GET /api/tactics/briefing?clubId= — KMIE v3 pre-match report for the
// manager's club: next fixture, the deterministic match-day environment,
// club snapshot (fan happiness, finances, spirit) and rival snapshot.
//
// PARITY GUARANTEE: the environment comes from `fixtureEnvironment(fixtureId)`
// in src/lib/engine/matches.ts — the SAME function the engine path calls right
// before simulating (seed derivation `KMIE-ENV:${fixtureId}` inside
// forecastEnvironment, draw order weather → temperature → pitch → referee →
// attendance). The briefing therefore matches the real match exactly.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";
import { stadiumCapacity } from "@/lib/engine/environment";
import { fixtureEnvironment } from "@/lib/engine/matches";
import { normalizeOrdersRaw } from "@/app/api/_lib/tactics-orders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);
  if (access.role === "MANAGER" && access.permissions.tactics === false) {
    return fail("FORBIDDEN", "Tactics permission not granted", 403);
  }

  const club = await db.club.findUnique({
    where: { id: clubId },
    select: {
      id: true, name: true, fanHappiness: true, finState: true, unpaidDays: true,
      divisionId: true,
      facilities: { select: { type: true, level: true } },
    },
  });
  if (!club) return fail("CLUB_NOT_FOUND", "Club not found", 404);

  // ── Next fixture: nearest SCHEDULED fixture the club takes part in.
  // Friendlies are tactical sandboxes but they ARE matches: a friendly is
  // shown when it is itself the next fixture on the calendar (competitive
  // fixtures are preferred whenever one kicks off earlier).
  const [nearestAny, nearestCompetitive, lineup, season] = await Promise.all([
    db.fixture.findFirst({
      where: { status: "SCHEDULED", OR: [{ homeId: clubId }, { awayId: clubId }] },
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true, competition: true, kickoffAt: true, homeId: true, awayId: true,
        home: { select: { id: true, name: true } },
        away: { select: { id: true, name: true } },
      },
    }),
    db.fixture.findFirst({
      where: {
        status: "SCHEDULED",
        competition: { not: "FRIENDLY" },
        OR: [{ homeId: clubId }, { awayId: clubId }],
      },
      orderBy: { kickoffAt: "asc" },
      select: {
        id: true, competition: true, kickoffAt: true, homeId: true, awayId: true,
        home: { select: { id: true, name: true } },
        away: { select: { id: true, name: true } },
      },
    }),
    db.lineup.findUnique({ where: { clubId } }),
    getActiveSeason(),
  ]);

  // Competitive preferred; the friendly survives only when it is the next match.
  const fixture =
    nearestCompetitive && nearestAny && nearestAny.kickoffAt < nearestCompetitive.kickoffAt
      ? nearestAny
      : (nearestCompetitive ?? nearestAny);

  if (!fixture) {
    return ok({ fixture: null });
  }

  const isHome = fixture.homeId === clubId;
  const rivalId = isHome ? fixture.awayId : fixture.homeId;
  const rivalName = isHome ? fixture.away.name : fixture.home.name;

  // ── Deterministic match-day environment — identical seed derivation as the
  // engine path (fixtureEnvironment → forecastEnvironment("KMIE-ENV:" + id)).
  const env = await fixtureEnvironment(fixture.id);
  const capacity = stadiumCapacity({ facilities: club.facilities });

  // ── Club + rival snapshots in parallel. ──
  const [rivalLineup, rivalClub] = await Promise.all([
    db.lineup.findUnique({ where: { clubId: rivalId }, select: { formation: true } }),
    db.club.findUnique({
      where: { id: rivalId },
      select: { id: true, name: true, divisionId: true },
    }),
  ]);
  const standings = season
    ? await db.standing.findMany({
        where: {
          seasonId: season.id,
          divisionId: { in: [club.divisionId, rivalClub?.divisionId ?? club.divisionId] },
        },
        select: { clubId: true, divisionId: true, points: true, gf: true, ga: true, played: true },
      })
    : [];

  // League position per club within its division (same ordering the standings
  // endpoint uses: points → GD → GF).
  const tables = new Map<string, typeof standings>();
  for (const row of standings) {
    const list = tables.get(row.divisionId) ?? [];
    list.push(row);
    tables.set(row.divisionId, list);
  }
  const positionOf = (cId: string, divisionId: string): number | null => {
    const list = tables.get(divisionId);
    if (!list) return null;
    const sorted = [...list].sort(
      (a, b) =>
        b.points - a.points ||
        b.gf - b.ga - (a.gf - a.ga) ||
        b.gf - a.gf ||
        a.clubId.localeCompare(b.clubId)
    );
    const idx = sorted.findIndex((r) => r.clubId === cId);
    return idx >= 0 ? idx + 1 : null;
  };
  const clubPosition = positionOf(clubId, club.divisionId);
  const rivalPosition = rivalClub ? positionOf(rivalClub.id, rivalClub.divisionId) : null;

  // Spirit proxy: average confidence across the chosen XI (0..100); falls back
  // to the club-level fan happiness when the XI is not set yet.
  const slots = (() => {
    try {
      return JSON.parse(lineup?.slots ?? "{}") as Record<string, string | null>;
    } catch {
      return {} as Record<string, string | null>;
    }
  })();
  const xiIds = [...new Set(Object.values(slots).filter((v): v is string => !!v))];
  const xiRows = xiIds.length
    ? await db.player.findMany({ where: { id: { in: xiIds } }, select: { confidence: true } })
    : [];
  const spirit = xiRows.length
    ? Math.round(xiRows.reduce((s, p) => s + p.confidence, 0) / xiRows.length)
    : club.fanHappiness;

  return ok({
    fixture: {
      id: fixture.id,
      rivalName,
      homeAway: isHome ? ("home" as const) : ("away" as const),
      kickoffUtc: fixture.kickoffAt.toISOString(),
      competition: fixture.competition,
    },
    env: {
      weather: env.weather,
      temperature: env.temperature,
      pitch: env.pitch,
      referee: env.referee.strictness,
      attendance: env.attendance ?? null,
      attendanceFill: env.attendance ? Math.round((env.attendance / Math.max(1, capacity)) * 100) : null,
      zone: env.zone,
    },
    club: {
      fanHappiness: club.fanHappiness,
      finState: club.finState,
      unpaidDays: club.unpaidDays,
      formation: lineup?.formation ?? "4-4-2",
      orders: normalizeOrdersRaw(lineup),
      position: clubPosition,
      spirit,
    },
    rival: {
      name: rivalName,
      formation: rivalLineup?.formation ?? null,
      position: rivalPosition,
    },
  });
}
