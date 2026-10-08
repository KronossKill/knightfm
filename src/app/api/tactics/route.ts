// GET  /api/tactics?clubId= — saved Lineup + squad availability summary.
// PUT  /api/tactics — validate & persist formation + slot assignments.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { FORMATION_LAYOUTS, FORMATIONS, Position } from "@/lib/types";
import { isAvailable, AutoPlayer } from "@/lib/engine/tactics";
import { getClubAccess, clubAccessError, parseJson } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  formation: z.enum(FORMATIONS),
  slots: z.record(z.string(), z.string().nullable()),
});

function toAutoPlayer(p: {
  id: string; position: string; detailedPos: string; ovr: number; fatigue: number;
  sharpness: number; morale: number; confidence: number; form: number;
  injuredUntil: Date | null; suspension: number;
}): AutoPlayer {
  return {
    id: p.id,
    position: p.position as Position,
    detailedPos: p.detailedPos,
    ovr: p.ovr,
    fatigue: p.fatigue,
    sharpness: p.sharpness,
    morale: p.morale,
    confidence: p.confidence,
    form: p.form,
    injuredUntil: p.injuredUntil,
    suspension: p.suspension,
  };
}

function availabilitySummary(players: AutoPlayer[]) {
  const now = new Date();
  const byPosition: Record<string, { total: number; available: number }> = {
    GK: { total: 0, available: 0 },
    DF: { total: 0, available: 0 },
    MF: { total: 0, available: 0 },
    FW: { total: 0, available: 0 },
  };
  let available = 0;
  let injured = 0;
  let suspended = 0;
  for (const p of players) {
    const pos = byPosition[p.position] ?? (byPosition[p.position] = { total: 0, available: 0 });
    pos.total += 1;
    const okPlayer = isAvailable(p, now);
    if (okPlayer) {
      available += 1;
      pos.available += 1;
    } else if (p.injuredUntil && p.injuredUntil > now) {
      injured += 1;
    } else if (p.suspension > 0) {
      suspended += 1;
    }
  }
  return { total: players.length, available, injured, suspended, byPosition };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const lineup = await db.lineup.findUnique({ where: { clubId } });
  const squad = await db.player.findMany({
    where: { clubId, retired: false, isYouth: false, isFreeAgent: false },
    select: {
      id: true, firstName: true, lastName: true, position: true, detailedPos: true,
      ovr: true, stars: true, fatigue: true, sharpness: true, morale: true,
      confidence: true, form: true, injuredUntil: true, suspension: true,
    },
    orderBy: [{ ovr: "desc" }],
  });

  return ok({
    clubId,
    formation: lineup?.formation ?? "4-4-2",
    slots: parseJson<Record<string, string | null>>(lineup?.slots ?? null, {}),
    inPossession: lineup?.inPossession ?? "balanced",
    outOfPossession: lineup?.outOfPossession ?? "balanced",
    updatedAt: lineup?.updatedAt ? lineup.updatedAt.toISOString() : null,
    availability: availabilitySummary(squad.map(toAutoPlayer)),
    squad: squad.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      detailedPos: p.detailedPos,
      ovr: p.ovr,
      stars: p.stars,
      available: isAvailable(toAutoPlayer(p)),
      injuredUntil: p.injuredUntil ? p.injuredUntil.toISOString() : null,
      suspension: p.suspension,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = putSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId, formation, slots } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);
  if (access.role === "MANAGER" && access.permissions.tactics === false) {
    return fail("FORBIDDEN", "Tactics permission not granted", 403);
  }

  // Slot ids must exactly match the formation layout.
  const expectedIds = FORMATION_LAYOUTS[formation].map((s) => s.id).sort();
  const givenIds = Object.keys(slots).sort();
  if (
    expectedIds.length !== givenIds.length ||
    expectedIds.some((v, i) => v !== givenIds[i])
  ) {
    return fail("INVALID_SLOTS", `Slot ids must match the ${formation} layout`, 400);
  }

  // Every assigned player must belong to this club and be available.
  const assigned = Object.entries(slots).filter(([, pid]) => !!pid) as [string, string][];
  const playerIds = [...new Set(assigned.map(([, pid]) => pid))];
  const squadRows = await db.player.findMany({
    where: { id: { in: playerIds } },
    select: {
      id: true, clubId: true, retired: true, isYouth: true, isFreeAgent: true,
      position: true, detailedPos: true, ovr: true, fatigue: true, sharpness: true,
      morale: true, confidence: true, form: true, injuredUntil: true, suspension: true,
    },
  });
  const byId = new Map(squadRows.map((p) => [p.id, p]));
  for (const pid of playerIds) {
    const p = byId.get(pid);
    if (!p || p.clubId !== clubId || p.retired || p.isYouth || p.isFreeAgent) {
      return fail("PLAYER_NOT_IN_SQUAD", `Player ${pid} is not part of this squad`, 400);
    }
    if (!isAvailable(toAutoPlayer(p))) {
      return fail("PLAYER_UNAVAILABLE", `Player ${pid} is injured or suspended`, 400);
    }
  }

  const total = FORMATION_LAYOUTS[formation].length;
  const filled = assigned.length;
  const completeness = total > 0 ? Math.round((filled / total) * 100) : 0;

  const savedSlots: Record<string, string | null> = {};
  for (const slotId of expectedIds) savedSlots[slotId] = slots[slotId] ?? null;

  await db.lineup.upsert({
    where: { clubId },
    create: { clubId, formation, slots: JSON.stringify(savedSlots) },
    update: { formation, slots: JSON.stringify(savedSlots) },
  });

  await audit("TACTICS_SAVED", auth.userId, { clubId, formation, filled, total, completeness });

  return ok({ saved: true, formation, slots: savedSlots, filled, total, completeness });
}
