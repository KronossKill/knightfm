// POST /api/facilities/upgrade — OWNER-only facility upgrade purchase.
// Cost = round(baseCost × targetLevel^1.6), debited atomically; the durable
// scheduler TIMER-SWEEP completes the upgrade (matching Facility.upgradeCompletesAt
// with the pending FacilityUpgrade row).

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { debitClub, FinanceError } from "@/lib/engine/finance";
import { FACILITY_TYPES } from "@/lib/types";
import { getClubAccess } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const upgradeSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  type: z.enum(FACILITY_TYPES),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = upgradeSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId, type } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  if (!access.club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (access.role !== "OWNER") return fail("FORBIDDEN", "Club owner role required", 403);

  const [maxLevel, baseCostCfg, upgradeDays] = await Promise.all([
    getInt("facilities.maxLevel", 10),
    getInt("facilities.baseCost", 80),
    getInt("facilities.upgradeDays", 5),
  ]);

  const facility = await db.facility.findUnique({
    where: { clubId_type: { clubId, type } },
  });
  const fromLevel = facility?.level ?? 1;

  if (fromLevel >= maxLevel) {
    return fail("MAX_LEVEL", `Facility ${type} is already at max level ${maxLevel}`, 400);
  }

  // No active upgrade for this facility type.
  const pending = await db.facilityUpgrade.findFirst({ where: { clubId, type, completedAt: null } });
  if (pending || (facility?.upgradeCompletesAt && facility.upgradeCompletesAt > new Date())) {
    return fail("UPGRADE_IN_PROGRESS", `Facility ${type} already has an upgrade in progress`, 409);
  }

  const toLevel = fromLevel + 1;
  const cost = Math.round(baseCostCfg * Math.pow(toLevel, 1.6));
  const now = new Date();
  const completesAt = new Date(now.getTime() + upgradeDays * 24 * 60 * 60 * 1000);
  // SECURITY (pentest fix — money printer): the debit idem key was
  // `FAC:<clubId>:<type>:<toLevel>` — entity-scoped. After a system-baseline
  // reset (club released → re-bought) the facility returns to level 1 but the
  // old LedgerEntry survived, so re-reaching the same level executed the whole
  // upgrade with the debit silently skipped. Each upgrade pays: the debit key
  // is now per-occurrence; the pending-upgrade guard above plus the unique
  // FacilityUpgrade key below still make the operation idempotent.
  const idemKey = `FAC:${clubId}:${type}:${toLevel}`;
  const debitKey = `FAC:${clubId}:${type}:${toLevel}:${randomUUID()}`;

  try {
    await db.$transaction(async (tx) => {
      await debitClub(tx, clubId, cost, "FACILITY", debitKey, `Facility ${type} upgrade L${fromLevel}→L${toLevel}`);
      await tx.facilityUpgrade.upsert({
        where: { idemKey },
        create: {
          clubId, type, fromLevel, toLevel, cost,
          startedAt: now, completesAt, idemKey,
        },
        update: { startedAt: now, completesAt, completedAt: null },
      });
      await tx.facility.upsert({
        where: { clubId_type: { clubId, type } },
        create: { clubId, type, level: fromLevel, upgradeStartedAt: now, upgradeCompletesAt: completesAt },
        update: { upgradeStartedAt: now, upgradeCompletesAt: completesAt },
      });
    });
  } catch (e) {
    if (e instanceof FinanceError) return fail(e.code, e.message, 402);
    throw e;
  }

  await audit("FACILITY_UPGRADE_STARTED", auth.userId, {
    clubId, type, fromLevel, toLevel, cost, completesAt: completesAt.toISOString(),
  });

  return ok({
    started: true,
    type,
    fromLevel,
    toLevel,
    cost,
    completesAt: completesAt.toISOString(),
  });
}
