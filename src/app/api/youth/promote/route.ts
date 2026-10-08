// POST /api/youth/promote — promote an academy prospect (age ≥
// players.youthPromotionAge) into the senior squad. Server-side capacity check;
// creates the Player, records a YOUTH_PROMOTION transfer, removes the prospect.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { computeCapacity } from "@/lib/engine/capacity";
import { computeMarketValue, computeBaseMarketValue, applyValueMultiplier, computeSalary, computeReleaseClause, computeRawOvr } from "@/lib/engine/ovr";
import { academyQualityCap } from "@/lib/engine/training";
import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { ATTRIBUTE_KEYS, FACILITY_TYPES, FacilityType } from "@/lib/types";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { getClubAccess, parseJson } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const promoteSchema = z.object({
  prospectId: z.string().min(1, "prospectId is required"),
});

const DETAILED_BY_POSITION: Record<string, string> = { GK: "GK", DF: "CB", MF: "CM", FW: "ST" };

interface FamilyAttrs {
  technical?: Record<string, number>;
  physical?: Record<string, number>;
  mental?: Record<string, number>;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = promoteSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { prospectId } = parsed.data;

  const prospect = await db.youthProspect.findUnique({ where: { id: prospectId } });
  if (!prospect) return fail("PROSPECT_NOT_FOUND", "Prospect not found", 404);

  const access = await getClubAccess(auth.userId, prospect.clubId);
  if (!access.club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (access.role === "NONE") return fail("FORBIDDEN", "No access to this club", 403);
  if (access.role === "MANAGER" && access.permissions.youth === false) {
    return fail("FORBIDDEN", "Youth permission not granted", 403);
  }

  const promoAge = await getInt("players.youthPromotionAge", 18);
  if (prospect.age < promoAge) {
    return fail("TOO_YOUNG", `Prospects can only be promoted at age ${promoAge} or older`, 400);
  }

  // Signing a youth requires a hired SCOUT (user requirement).
  const scout = await db.staffMember.findFirst({
    where: { clubId: prospect.clubId, role: "SCOUT" },
    select: { id: true, quality: true },
    orderBy: { quality: "desc" },
  });
  if (!scout) {
    return fail("SCOUT_REQUIRED", "A hired scout is required to sign youth players", 400);
  }

  // Signable quality depends on the YOUTH_ACADEMY level (configurable cap).
  const academy = await db.facility.findUnique({
    where: { clubId_type: { clubId: prospect.clubId, type: "YOUTH_ACADEMY" } },
    select: { level: true },
  });
  const qualityCap = await academyQualityCap(academy?.level ?? 1);
  if (prospect.quality > qualityCap) {
    return fail(
      "ACADEMY_CAP",
      `Youth academy level ${academy?.level ?? 1} can only sign prospects with quality ≤ ${qualityCap}. Upgrade the academy.`,
      403,
      { qualityCap, prospectQuality: prospect.quality, academyLevel: academy?.level ?? 1 }
    );
  }

  // Server-side squad capacity (ICP entitlement).
  const [baseCapacity, maxBonusSlots, wTraining, wMedical, wYouth, wScience] = await Promise.all([
    getInt("squad.baseCapacity", 25),
    getInt("squad.maxBonusSlots", 20),
    getInt("squad.icpTrainingWeight", 30),
    getInt("squad.icpMedicalWeight", 25),
    getInt("squad.icpYouthWeight", 25),
    getInt("squad.icpScienceWeight", 20),
  ]);
  const facilities = await db.facility.findMany({ where: { clubId: prospect.clubId } });
  const levels: Record<FacilityType, number> = {
    STADIUM: 1, TRAINING_CENTER: 1, YOUTH_ACADEMY: 1, MEDICAL_CENTER: 1, SPORTS_SCIENCE: 1, REST_ROOMS: 1,
  };
  for (const f of facilities) {
    if ((FACILITY_TYPES as readonly string[]).includes(f.type)) levels[f.type as FacilityType] = f.level;
  }
  const cap = computeCapacity({
    baseCapacity, maxBonusSlots, levels,
    weights: { training: wTraining, medical: wMedical, youth: wYouth, science: wScience },
  });
  const playerCount = await db.player.count({
    where: { clubId: prospect.clubId, retired: false, isYouth: false, isFreeAgent: false },
  });
  if (playerCount >= cap.capacity) {
    return fail("CAPACITY_FULL", `Squad capacity reached (${playerCount}/${cap.capacity})`, 403);
  }

  // Build senior attributes from the prospect profile, centred on a fresh
  // 1-star-ish OVR derived from scouted quality.
  const position = prospect.position as "GK" | "DF" | "MF" | "FW";
  const rng = mulberry32(seedFromString(`PROMOTE:${prospect.id}`));
  const src = parseJson<FamilyAttrs>(prospect.attributes, {});
  const targetOvr = Math.max(30, Math.min(58, Math.round(prospect.quality * 0.5 + 22)));

  const attributes: Record<string, Record<string, number>> = { technical: {}, physical: {}, mental: {} };
  for (const family of Object.keys(ATTRIBUTE_KEYS) as (keyof typeof ATTRIBUTE_KEYS)[]) {
    for (const key of ATTRIBUTE_KEYS[family]) {
      const srcVal = src[family]?.[key];
      const base = typeof srcVal === "number" ? srcVal : prospect.quality;
      attributes[family][key] = Math.max(1, Math.min(99, Math.round(targetOvr + (base - prospect.quality) + (rng() * 4 - 2))));
    }
  }
  // Keep the cached OVR consistent with the generated attribute profile.
  const computedOvr = computeRawOvr(
    { technical: attributes.technical, physical: attributes.physical, mental: attributes.mental },
    position
  );
  const finalOvr = Math.max(30, Math.min(58, computedOvr || targetOvr));

  const [salaryPct, clauseMult, season] = await Promise.all([
    getInt("economy.playerSalaryRatePct", 1),
    getInt("economy.releaseClauseMultiplier", 5),
    getActiveSeason(),
  ]);
  // Task 27: stored VALUE = base × market.playerValueMultiplier (default 3);
  // the salary derives from the BASE value so wage bills stay sustainable.
  const baseValue = computeBaseMarketValue(finalOvr, prospect.age);
  const marketValue = applyValueMultiplier(baseValue, await getInt("market.playerValueMultiplier", 3));
  const gameDay = await currentGameDay();

  const player = await db.$transaction(async (tx) => {
    const created = await tx.player.create({
      data: {
        clubId: prospect.clubId,
        firstName: prospect.firstName,
        lastName: prospect.lastName,
        age: prospect.age,
        position,
        detailedPos: DETAILED_BY_POSITION[position] ?? position,
        stars: 1,
        ovr: finalOvr,
        potential: Math.min(95, Math.max(finalOvr + 6, Math.round(prospect.quality * 0.9 + 18))),
        marketValue,
        salary: computeSalary(baseValue, salaryPct),
        releaseClause: computeReleaseClause(marketValue, clauseMult),
        attributes: JSON.stringify(attributes),
        form: 50,
        fatigue: 10,
        sharpness: 60,
        morale: 60,
        confidence: 60,
        // Task 23-d: first appearance in senior football → his birthday anchor.
        birthDay: gameDay,
        nextAgeDay: gameDay + 30,
      },
    });
    await tx.transferRecord.create({
      data: {
        playerId: created.id,
        clubToId: prospect.clubId,
        amount: 0,
        fee: 0,
        levy: 0,
        type: "YOUTH_PROMOTION",
        seasonId: season?.id ?? "UNKNOWN",
        day: gameDay,
      },
    });
    await tx.youthProspect.delete({ where: { id: prospect.id } });
    return created;
  });

  await audit("YOUTH_PROMOTED", auth.userId, {
    prospectId: prospect.id,
    playerId: player.id,
    clubId: prospect.clubId,
    ovr: finalOvr,
    age: prospect.age,
  });

  return ok({
    promoted: true,
    playerId: player.id,
    name: `${player.firstName} ${player.lastName}`,
    ovr: finalOvr,
    potential: player.potential,
    squadSize: playerCount + 1,
    capacity: cap.capacity,
  });
}
