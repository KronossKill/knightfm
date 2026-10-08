// GET /api/staff/candidates?clubId=&role=&stars= — daily candidate pool for ONE
// staff area at a chosen star quality (1–5). The pool is deterministic per
// (club, role, stars, day) and bounded by the area facility's quality ceiling;
// a star level the facility cannot support returns an empty list.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { candidatesForRole, AREA_FACILITY, STAFF_ROLES, type StaffRole } from "../route";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const sp = req.nextUrl.searchParams;
  const clubId = sp.get("clubId");
  const role = sp.get("role");
  const stars = Number(sp.get("stars"));
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);
  if (!(STAFF_ROLES as readonly string[]).includes(role ?? "")) {
    return fail("ROLE_INVALID", "Unknown staff area", 400);
  }
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return fail("STARS_INVALID", "stars must be an integer between 1 and 5", 400);
  }

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const staffRole = role as StaffRole;
  const day = await currentGameDay();
  const [facilityRow, hired] = await Promise.all([
    db.facility.findFirst({ where: { clubId, type: AREA_FACILITY[staffRole] }, select: { level: true } }),
    db.staffMember.findMany({ where: { clubId, role: staffRole }, select: { name: true } }),
  ]);
  const facilityLevel = facilityRow?.level ?? 1;

  // Persons already on the payroll leave today's pool (no duplicate hires).
  const hiredNames = new Set(hired.map((h) => h.name.toLowerCase()));
  const candidates = (await candidatesForRole(clubId, staffRole, stars, day, facilityLevel)).filter(
    (c) => !hiredNames.has(c.name.toLowerCase())
  );
  return ok({ clubId, role: staffRole, stars, day, facilityLevel, candidates });
}
