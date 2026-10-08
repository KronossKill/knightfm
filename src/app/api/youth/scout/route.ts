// POST /api/youth/scout — run a scouting session.
// Requires a SCOUT staff member; prospect quality is influenced by scout
// quality + YOUTH_ACADEMY level + mandatory randomness.
// User mandate (Task 21): scouting is allowed ONCE PER CLUB PER GAME DAY —
// enforced server-side by a YouthScoutSession row (unique [clubId, day]).
// User mandate (Task 23-a): a session reveals EXACTLY as many prospects as
// the SCOUT's star rating (1★→1, 2★→2, … 5★→5) — no more random counts.
// User mandate (Task 26): the YOUTH_ACADEMY level caps how many prospects the
// club can hold (level 1 = youth.baseCapacity, default 3) — a session reveals
// at most the remaining space and fails with YOUTH_FULL when the cantera is full.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, clientIp, fail, isResponse, ok, rateLimit, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { generatePlayerName } from "@/lib/engine/names";
import { academyQualityCap, getYouthCapacity } from "@/lib/engine/training";
import { starsFor } from "@/lib/staff-quality";
import { ATTRIBUTE_KEYS } from "@/lib/types";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const scoutSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
});

const DETAILED_BY_POSITION: Record<string, string[]> = {
  GK: ["GK"],
  DF: ["CB", "LB", "RB"],
  MF: ["DM", "CM", "AM", "LM", "RM"],
  FW: ["LW", "RW", "ST"],
};

// Pool ceiling is configurable (youth.maxProspectsPool); the effective
// capacity comes from the YOUTH_ACADEMY level via getYouthCapacity().
async function maxProspects(): Promise<number> {
  return getInt("youth.maxProspectsPool", 50);
}

function pickPosition(rng: () => number): "GK" | "DF" | "MF" | "FW" {
  const r = rng();
  if (r < 0.1) return "GK";
  if (r < 0.42) return "DF";
  if (r < 0.75) return "MF";
  return "FW";
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const limited = rateLimit(`youth-scout:${auth.userId}:${clientIp(req)}`, 6, 60_000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", `Too many scouting sessions; retry in ${limited.retryAfterSec}s`, 429);
  }

  const parsed = scoutSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const scout = await db.staffMember.findFirst({
    where: { clubId, role: "SCOUT" },
    orderBy: { quality: "desc" },
  });
  if (!scout) return fail("NO_SCOUT", "A SCOUT staff member is required to run scouting sessions", 400);

  const academy = await db.facility.findUnique({
    where: { clubId_type: { clubId, type: "YOUTH_ACADEMY" } },
    select: { level: true },
  });
  const academyLevel = academy?.level ?? 1;
  const gameDay = await currentGameDay();

  // Task 26: the academy level caps the cantera — level 1 holds exactly
  // youth.baseCapacity (default 3) prospects and grows with each upgrade.
  const capacity = await getYouthCapacity(academyLevel);
  const used = await db.youthProspect.count({ where: { clubId } });
  const space = Math.max(0, capacity - used);

  // Once per club per game day (user mandate Task 21).
  const alreadyToday = await db.youthScoutSession.findUnique({
    where: { clubId_day: { clubId, day: gameDay } },
    select: { id: true },
  });
  if (alreadyToday) {
    return fail("SCOUT_ALREADY_DONE", "The scouting session was already run today (one per day)", 409, { day: gameDay });
  }
  if (space <= 0) {
    return fail("YOUTH_FULL", "The youth academy is at capacity — upgrade the YOUTH_ACADEMY to scout more prospects", 409, { capacity, used });
  }

  // SECURITY (pentest fix — TOCTOU): the once-per-day lock used to be written
  // AFTER creating the prospects, so two concurrent sessions both passed the
  // check and minted extra prospects (P2002 on the loser only after all rows
  // were created). The unique [clubId, day] row is now the FIRST write: the
  // loser of the race gets P2002 before generating anything.
  try {
    await db.youthScoutSession.create({ data: { clubId, day: gameDay } });
  } catch {
    return fail("SCOUT_ALREADY_DONE", "The scouting session was already run today (one per day)", 409, { day: gameDay });
  }

  // Mandatory randomness in quality (seeded per session, not per world state).
  const rng = mulberry32(seedFromString(`SCOUT:${clubId}:${gameDay}:${Date.now()}:${auth.userId}`));

  // User mandate (Task 23-a): the session reveals EXACTLY as many prospects as
  // the scout's star rating — 1★→1, 2★→2, … 5★→5 — capped by the academy's
  // remaining capacity (Task 26).
  const scoutStars = starsFor(scout.quality);
  const sessionCount = Math.min(scoutStars, space);
  const created: { id: string; firstName: string; lastName: string; age: number; position: string; quality: number; scouted: boolean; reportDepth: number }[] = [];
  for (let i = 0; i < sessionCount; i++) {
    const quality = Math.max(5, Math.min(95, Math.round(18 + scout.quality * 0.4 + academyLevel * 2.5 + rng() * 22)));
    const position = pickPosition(rng);
    const detailed = DETAILED_BY_POSITION[position];
    const detailedPos = detailed[Math.floor(rng() * detailed.length)];
    const { firstName, lastName } = generatePlayerName(rng);

    const attributes: Record<string, Record<string, number>> = { technical: {}, physical: {}, mental: {} };
    for (const family of Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]) {
      for (const key of ATTRIBUTE_KEYS[family]) {
        attributes[family][key] = Math.max(1, Math.min(99, Math.round(quality + (rng() * 16 - 8))));
      }
    }

    const prospect = await db.youthProspect.create({
      data: {
        clubId,
        firstName,
        lastName,
        age: 15 + Math.floor(rng() * 4), // 15-18: some prospects are signable right away
        position,
        quality,
        attributes: JSON.stringify(attributes),
        scouted: true,
        scoutedBy: auth.userId,
        reportDepth: Math.max(0, Math.min(5, Math.floor(scout.quality / 20))),
        generatedOn: gameDay,
        // Task 23-d: first appearance today → this is his birthday anchor.
        birthDay: gameDay,
        nextAgeDay: gameDay + 30,
      },
    });
    created.push(prospect);
  }


  // Pool cap: trim oldest prospects beyond the configurable pool size.
  const maxPool = await maxProspects();
  const total = await db.youthProspect.count({ where: { clubId } });
  const excess = total - maxPool;
  if (excess > 0) {
    const stale = await db.youthProspect.findMany({
      where: { clubId },
      orderBy: { createdAt: "asc" },
      take: excess,
      select: { id: true },
    });
    for (const s of stale) await db.youthProspect.delete({ where: { id: s.id } }).catch(() => undefined);
  }

  await audit("YOUTH_SCOUTED", auth.userId, {
    clubId,
    count: created.length,
    scoutQuality: scout.quality,
    scoutStars,
    academyLevel,
    capacity,
    used: used + created.length,
    day: gameDay,
  });

  const qualityCap = await academyQualityCap(academyLevel);

  return ok({
    scouted: created.length,
    academyQualityCap: qualityCap,
    capacity,
    used: used + created.length,
    space: Math.max(0, space - created.length),
    prospects: created.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      position: p.position,
      quality: p.quality,
      scouted: p.scouted,
      reportDepth: p.reportDepth,
    })),
  });
}
