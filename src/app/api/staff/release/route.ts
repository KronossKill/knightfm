// POST /api/staff/release — release a staff member (OWNER/MANAGER).
// Task 26: severance = daily salary × REMAINING CONTRACT DAYS (rest of the
// season) × staff.severanceMultiplier, debited from the CLUB treasury and
// credited to the SYSTEM fund (dismissal funds never reach another user).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { debitClub, creditFund, FinanceError } from "@/lib/engine/finance";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import { getActiveSeason } from "@/app/api/_lib/active-season";
import { financeErrorResponse } from "../../_lib/markets-lib";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const Body = z.object({
  staffId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "staffId is required", 400);
  const { staffId } = parsed.data;

  const member = await db.staffMember.findUnique({ where: { id: staffId } });
  if (!member) return fail("STAFF_NOT_FOUND", "Staff member not found", 404);

  const access = await getClubAccess(auth.userId, member.clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const [severanceMultiplier, day] = await Promise.all([
    getInt("staff.severanceMultiplier", 1),
    currentGameDay(),
  ]);
  // Task 26: dismissal pays the REMAINING CONTRACT DAYS — staff contracts run
  // to the end of the current season (same as players) — times the
  // configurable factor (default 1 = exactly the remaining salary).
  const season = await getActiveSeason();
  const endEpochDay = season ? season.startEpochDay + SEASON_TOTAL_DAYS - 1 : day - 1;
  const daysRemaining = Math.max(0, endEpochDay - day + 1);
  const severance = member.salary * daysRemaining * severanceMultiplier;

  try {
    await db.$transaction(async (tx) => {
      if (severance > 0) {
        await debitClub(tx, member.clubId, severance, "STAFF_SEVERANCE", `STAFFREL:${member.id}:${day}`, `Severance for ${member.name} (${member.role}) — ${daysRemaining} contract days remaining`);
        // Task 26: dismissal funds go to the SYSTEM fund (never to another user).
        await creditFund(tx, "SYSTEM", severance, `STAFFREL:${member.id}:${day}:SYSTEM`, "STAFF_SEVERANCE", `Dismissal severance routed to the system fund: ${member.name} (${member.role})`);
      }
      await tx.staffMember.delete({ where: { id: member.id } });
    });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "INSUFFICIENT_CLUB_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", e.message, 402);
    }
    throw e;
  }

  await audit("STAFF_RELEASE", auth.userId, {
    clubId: member.clubId, role: member.role, name: member.name, severance, daysRemaining, multiplier: severanceMultiplier, day,
  });
  return ok({ id: member.id, released: true, severance, daysRemaining });
}
