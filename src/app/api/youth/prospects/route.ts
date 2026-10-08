// GET /api/youth/prospects?clubId= — youth academy prospects (age 14-17) with
// scouted quality ranges (report depth narrows the band).

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { academyQualityCap, getYouthCapacity } from "@/lib/engine/training";
import { currentGameDay } from "@/lib/engine/clock";
import { starsFor } from "@/lib/staff-quality";
import { getClubAccess, clubAccessError, parseJson } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

interface ProspectAttrs {
  technical?: Record<string, number>;
  physical?: Record<string, number>;
  mental?: Record<string, number>;
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const prospects = await db.youthProspect.findMany({
    where: { clubId },
    orderBy: [{ scouted: "desc" }, { createdAt: "asc" }],
  });

  const gameDay = await currentGameDay();
  const [youthPromotionAge, academy, bestScout, scoutedTodayRow] = await Promise.all([
    getInt("players.youthPromotionAge", 18),
    db.facility.findUnique({
      where: { clubId_type: { clubId, type: "YOUTH_ACADEMY" } },
      select: { level: true },
    }),
    db.staffMember.findFirst({
      where: { clubId, role: "SCOUT" },
      select: { name: true, quality: true },
      orderBy: { quality: "desc" },
    }),
    db.youthScoutSession.findUnique({
      where: { clubId_day: { clubId, day: gameDay } },
      select: { id: true },
    }),
  ]);
  const academyLevel = academy?.level ?? 1;
  const qualityCap = await academyQualityCap(academyLevel);
  // Task 26: academy-level capacity of the cantera (level 1 = base, grows per upgrade).
  const youthCapacity = await getYouthCapacity(academyLevel);
  // Task 23-a: a session reveals exactly as many prospects as the scout's stars.
  const scoutStars = bestScout ? starsFor(bestScout.quality) : 0;

  const list = prospects.map((p) => {
    const spread = Math.max(4, 12 - p.reportDepth * 2);
    return {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      position: p.position,
      quality: p.quality,
      qualityRange: { min: Math.max(0, p.quality - spread), max: Math.min(100, p.quality + spread) },
      attributes: parseJson<ProspectAttrs>(p.attributes, {}),
      scouted: p.scouted,
      reportDepth: p.reportDepth,
      generatedOn: p.generatedOn,
      promotable: p.age >= youthPromotionAge,
      // Signable = old enough AND within the academy's quality cap.
      signable: p.age >= youthPromotionAge && p.quality <= qualityCap,
      aboveCap: p.quality > qualityCap,
    };
  });

  return ok({
    clubId,
    prospects: list,
    count: list.length,
    youthPromotionAge,
    academyLevel,
    academyQualityCap: qualityCap,
    // Task 26: capacity of the youth installation (used/space for the UI badge).
    youthCapacity,
    used: list.length,
    capacitySpace: Math.max(0, youthCapacity - list.length),
    hasScout: !!bestScout,
    bestScout: bestScout ?? null,
    // Task 23-a: prospects per scouting session = scout's star rating.
    scoutStars,
    prospectsPerSession: scoutStars,
    day: gameDay,
    // Once-per-day scout limit (Task 21): true when today's session was used.
    scoutedToday: !!scoutedTodayRow,
  });
}
