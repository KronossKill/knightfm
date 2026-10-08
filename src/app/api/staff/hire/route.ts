// POST /api/staff/hire — hire one candidate into an area (OWNER/MANAGER).
// Flow: the client first picks the member's star quality (1–5), then the person
// from that star's daily pool. Fee comes from the per-star pricing config
// (staff.starFee.N), debited atomically from the CLUB treasury.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, readJson } from "@/lib/api";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { debitClub, FinanceError } from "@/lib/engine/finance";
import { financeErrorResponse } from "../../_lib/markets-lib";
import { candidatesForRole, starPricing, AREA_FACILITY, STAFF_ROLES, type StaffRole } from "../route";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

const Body = z.object({
  clubId: z.string().min(1),
  role: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  candidateId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "clubId, role, stars (1-5) and candidateId are required", 400);
  const { clubId, role, stars, candidateId } = parsed.data;

  if (!(STAFF_ROLES as readonly string[]).includes(role)) {
    return fail("ROLE_INVALID", "Unknown staff area", 400);
  }
  const staffRole = role as StaffRole;

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const [count, maxPerRole, facilities, day] = await Promise.all([
    db.staffMember.count({ where: { clubId, role } }),
    getInt("staff.maxPerRole", 3),
    db.facility.findMany({ where: { clubId }, select: { type: true, level: true } }),
    currentGameDay(),
  ]);
  if (count >= maxPerRole) {
    return fail("MAX_PER_ROLE", `The ${role} area already has the maximum of ${maxPerRole} staff members`, 409, { maxPerRole });
  }

  const facilityLevel = facilities.find((f) => f.type === AREA_FACILITY[staffRole])?.level ?? 1;
  const pool = await candidatesForRole(clubId, staffRole, stars, day, facilityLevel);
  const candidate = pool.find((c) => c.id === candidateId);
  if (!candidate) return fail("CANDIDATE_EXPIRED", "This candidate is no longer available (offers rotate daily)", 400);

  // A person already on the payroll cannot be hired twice.
  const dup = await db.staffMember.findFirst({
    where: { clubId, role, name: candidate.name },
    select: { id: true },
  });
  if (dup) return fail("CANDIDATE_EXPIRED", "This candidate is no longer available (already on your staff)", 400);

  // Re-derive the fee from the star pricing config (never trust the client).
  const { fee } = await starPricing(stars, candidate.quality);
  const idemKey = `STAFFHIRE:${clubId}:${staffRole}:${day}:${candidateId}`;

  try {
    const staff = await db.$transaction(async (tx) => {
      if (fee > 0) {
        await debitClub(tx, clubId, fee, "STAFF_HIRE", idemKey, `Hired ${candidate.name} as ${staffRole}`);
      }
      return tx.staffMember.create({
        data: {
          clubId,
          role,
          name: candidate.name,
          specialization: candidate.specialization,
          quality: candidate.quality,
          salary: candidate.salary,
        },
      });
    });

    await audit("STAFF_HIRE", auth.userId, {
      clubId, role, stars, staffId: staff.id, name: staff.name, quality: staff.quality, fee, day,
    });
    return ok({
      staff: {
        id: staff.id, role: staff.role, name: staff.name, specialization: staff.specialization,
        quality: staff.quality, salary: staff.salary, createdAt: staff.createdAt.toISOString(),
      },
      fee,
    });
  } catch (e) {
    const mapped = financeErrorResponse(e);
    if (mapped) return mapped;
    if (e instanceof FinanceError && e.code === "INSUFFICIENT_CLUB_FUNDS") {
      return fail("INSUFFICIENT_FUNDS", e.message, 402);
    }
    throw e;
  }
}
