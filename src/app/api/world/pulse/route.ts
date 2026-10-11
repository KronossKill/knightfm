// GET /api/world/pulse — authenticated "living world" feed for the World Pulse
// dashboard widget (Master UI/UX v2.0 mandate: keep the player connected to the
// wider football world — fixes FM26's "lost world building" criticism).
//
// Read-only, cheap, indexed queries only ([kickoffAt,status] index on Fixture,
// 5-minute online window on Presence). Never mutates game state.

import { NextRequest } from "next/server";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // D-009 presence window, same as /api/presence

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

  const [season, results, upcoming, onlineRows] = await Promise.all([
    db.season.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
    db.fixture.findMany({
      where: { status: "PLAYED", matchId: { not: null } },
      orderBy: { kickoffAt: "desc" },
      take: 8,
      select: {
        id: true,
        competition: true,
        stage: true,
        matchDay: true,
        kickoffAt: true,
        match: { select: { homeGoals: true, awayGoals: true } },
        home: { select: { name: true } },
        away: { select: { name: true } },
      },
    }),
    db.fixture.findMany({
      where: { status: "SCHEDULED" },
      orderBy: { kickoffAt: "asc" },
      take: 6,
      select: {
        id: true,
        competition: true,
        stage: true,
        matchDay: true,
        kickoffAt: true,
        home: { select: { name: true } },
        away: { select: { name: true } },
      },
    }),
    db.presence.findMany({
      where: { lastSeenAt: { gte: onlineSince } },
      select: { country: true },
    }),
  ]);

  // Aggregate the online-by-country snapshot in JS (tiny table, single fetch).
  const byCountry = new Map<string, number>();
  for (const row of onlineRows) {
    const key = row.country ?? "??";
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }
  const countries = [...byCountry.entries()]
    .map(([country, n]) => ({ country, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  return ok({
    seasonNumber: season?.number ?? null,
    online: { total: onlineRows.length, countries },
    results: results.map((f) => ({
      id: f.id,
      competition: f.competition,
      stage: f.stage,
      matchDay: f.matchDay,
      kickoffAt: f.kickoffAt.toISOString(),
      home: f.home.name,
      away: f.away.name,
      homeGoals: f.match?.homeGoals ?? null,
      awayGoals: f.match?.awayGoals ?? null,
    })),
    upcoming: upcoming.map((f) => ({
      id: f.id,
      competition: f.competition,
      stage: f.stage,
      matchDay: f.matchDay,
      kickoffAt: f.kickoffAt.toISOString(),
      home: f.home.name,
      away: f.away.name,
    })),
  });
}
