// GET /api/facilities?clubId= — facility levels, active upgrades with live
// progress, ICP/capacity breakdown and per-type upgrade cost preview.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { computeCapacity } from "@/lib/engine/capacity";
import { FACILITY_TYPES, FacilityType } from "@/lib/types";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const [maxLevel, baseCostCfg, upgradeDays, wTraining, wMedical, wYouth, wScience, baseCapacity, maxBonusSlots] =
    await Promise.all([
      getInt("facilities.maxLevel", 10),
      getInt("facilities.baseCost", 80),
      getInt("facilities.upgradeDays", 5),
      getInt("squad.icpTrainingWeight", 30),
      getInt("squad.icpMedicalWeight", 25),
      getInt("squad.icpYouthWeight", 25),
      getInt("squad.icpScienceWeight", 20),
      getInt("squad.baseCapacity", 25),
      getInt("squad.maxBonusSlots", 20),
    ]);

  const facilities = await db.facility.findMany({ where: { clubId } });
  const pending = await db.facilityUpgrade.findMany({ where: { clubId, completedAt: null } });
  const pendingByType = new Map(pending.map((u) => [u.type, u]));

  const now = Date.now();
  const levels: Record<FacilityType, number> = {
    STADIUM: 1,
    TRAINING_CENTER: 1,
    YOUTH_ACADEMY: 1,
    MEDICAL_CENTER: 1,
    SPORTS_SCIENCE: 1,
    REST_ROOMS: 1,
  };
  for (const f of facilities) {
    if ((FACILITY_TYPES as readonly string[]).includes(f.type)) levels[f.type as FacilityType] = f.level;
  }

  const cap = computeCapacity({
    baseCapacity,
    maxBonusSlots,
    levels,
    weights: { training: wTraining, medical: wMedical, youth: wYouth, science: wScience },
  });

  const facilityViews = FACILITY_TYPES.map((type) => {
    const row = facilities.find((f) => f.type === type);
    const level = levels[type];
    const upgrade = pendingByType.get(type);
    let progressPct: number | null = null;
    if (upgrade) {
      const span = upgrade.completesAt.getTime() - upgrade.startedAt.getTime();
      progressPct =
        span > 0 ? Math.max(0, Math.min(100, Math.round(((now - upgrade.startedAt.getTime()) / span) * 100))) : 100;
    }
    const nextLevel = level < maxLevel ? level + 1 : null;
    return {
      type,
      level,
      upgrade: upgrade
        ? {
            toLevel: upgrade.toLevel,
            startedAt: upgrade.startedAt.toISOString(),
            completesAt: upgrade.completesAt.toISOString(),
            progressPct: progressPct ?? 0,
          }
        : null,
      nextLevelCost: nextLevel !== null ? Math.round(baseCostCfg * Math.pow(nextLevel, 1.6)) : null,
      durationDays: upgradeDays,
    };
  });

  return ok({
    clubId,
    config: { maxLevel, baseCost: baseCostCfg, upgradeDays, restRecoveryPerLevel: await getInt("facilities.restRecoveryPerLevel", 2) },
    facilities: facilityViews,
    icp: {
      icp: Math.round(cap.icp * 1000) / 1000,
      bonusSlots: cap.bonusSlots,
      baseCapacity,
      finalCapacity: cap.capacity,
      weights: { training: wTraining, medical: wMedical, youth: wYouth, science: wScience },
      playerCount: await db.player.count({
        where: { clubId, retired: false, isYouth: false, isFreeAgent: false },
      }),
    },
  });
}
