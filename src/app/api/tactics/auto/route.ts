// POST /api/tactics/auto — run the multi-factor auto-complete (engine/tactics)
// and persist the resulting lineup. Managers need the `tactics` permission.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { FORMATION_LAYOUTS, FORMATIONS, Position } from "@/lib/types";
import { autoCompleteLineup } from "@/lib/engine/tactics";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const autoSchema = z.object({
  clubId: z.string().min(1, "clubId is required"),
  formation: z.enum(FORMATIONS).optional(), // defaults to saved formation / 4-4-2
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = autoSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { clubId } = parsed.data;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);
  if (access.role === "MANAGER" && access.permissions.tactics === false) {
    return fail("FORBIDDEN", "Tactics permission not granted", 403);
  }

  const existing = await db.lineup.findUnique({ where: { clubId } });
  const formation = parsed.data.formation ?? (existing?.formation as (typeof FORMATIONS)[number]) ?? "4-4-2";

  const squad = await db.player.findMany({
    where: { clubId, retired: false, isYouth: false, isFreeAgent: false },
    select: {
      id: true, position: true, detailedPos: true, ovr: true, fatigue: true,
      sharpness: true, morale: true, confidence: true, form: true,
      injuredUntil: true, suspension: true,
    },
  });

  const autoPlayers = squad.map((p) => ({
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
  }));

  const results = autoCompleteLineup(autoPlayers, formation);
  const slots: Record<string, string | null> = {};
  for (const r of results) slots[r.slotId] = r.playerId;

  const total = FORMATION_LAYOUTS[formation].length;
  const filled = results.filter((r) => r.playerId).length;
  const completeness = total > 0 ? Math.round((filled / total) * 100) : 0;

  await db.lineup.upsert({
    where: { clubId },
    create: { clubId, formation, slots: JSON.stringify(slots) },
    update: { formation, slots: JSON.stringify(slots) },
  });

  await audit("TACTICS_SAVED", auth.userId, { clubId, formation, auto: true, filled, total, completeness });

  return ok({ formation, slots, filled, total, completeness });
}
