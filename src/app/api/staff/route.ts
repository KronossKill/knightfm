// GET /api/staff?clubId= — technical staff for a club, grouped by area, plus the
// per-area hiring meta (facility level → max selectable star quality).
// Areas: COACH | SCOUT | MEDIC | PHYSIO | ANALYST.
// Candidates are fetched on demand per (role, stars) via /api/staff/candidates.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getInt } from "@/lib/config";
import { currentGameDay } from "@/lib/engine/clock";
import { mulberry32, seedFromString } from "@/lib/engine/kmie";
import { generatePlayerName } from "@/lib/engine/names";
import { maxStarsForFacility, qualityCeilingFor, starRequirements, STAR_BANDS } from "@/lib/staff-quality";
import { getClubAccess, clubAccessError } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

export const STAFF_ROLES = ["COACH", "SCOUT", "MEDIC", "PHYSIO", "ANALYST"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Area → facility that bounds the candidate quality pool. */
export const AREA_FACILITY: Record<StaffRole, string> = {
  COACH: "TRAINING_CENTER",
  SCOUT: "YOUTH_ACADEMY",
  MEDIC: "MEDICAL_CENTER",
  PHYSIO: "REST_ROOMS",
  ANALYST: "SPORTS_SCIENCE",
};

const COACH_SPECIALIZATIONS = ["technical", "physical", "mental", "set_pieces"] as const;

export interface StaffCandidate {
  id: string;
  role: StaffRole;
  stars: number;
  name: string;
  specialization: string | null;
  quality: number;
  hireFee: number;
  salary: number;
}

/** Star-based pricing (user mandate Task 21): fee and daily salary are
 *  configurable PER STAR LEVEL in the Control Center; the quality-based
 *  factor (staff.hireCostPerQuality) is only the fallback when the per-star
 *  value is 0. Shared by the candidate generator and the hire route so the
 *  client-facing fee always matches the server-charged fee. */
export async function starPricing(
  stars: number,
  quality: number
): Promise<{ fee: number; salary: number }> {
  const hireCostPerQuality = await getInt("staff.hireCostPerQuality", 2);
  const [cfgFee, cfgSalary] = await Promise.all([
    getInt(`staff.starFee.${stars}`, 0),
    getInt(`staff.starSalary.${stars}`, 0),
  ]);
  return {
    fee: cfgFee > 0 ? cfgFee : quality * hireCostPerQuality,
    salary: cfgSalary > 0 ? cfgSalary : Math.max(1, Math.round(quality / 8)),
  };
}

/** Deterministic per (club, role, stars, day) candidate pool — regenerating
 *  reproduces the same pool. Quality is drawn inside the star's band, capped by
 *  the facility ceiling; a band entirely above the ceiling yields no candidates. */
export async function candidatesForRole(
  clubId: string,
  role: StaffRole,
  stars: number,
  day: number,
  facilityLevel: number
): Promise<StaffCandidate[]> {
  const band = STAR_BANDS[stars] ?? STAR_BANDS[1];
  const ceiling = qualityCeilingFor(facilityLevel);
  const lo = band.min;
  const hi = Math.min(band.max, ceiling);
  if (lo > hi) return []; // star level not reachable with this facility level

  const rng = mulberry32(seedFromString(`STAFFCAND:${clubId}:${role}:${stars}:${day}`));
  const out: StaffCandidate[] = [];
  for (let i = 0; i < 3; i++) {
    const quality = lo + Math.floor(rng() * (hi - lo + 1));
    const { firstName, lastName } = generatePlayerName(rng);
    const specialization = role === "COACH" ? COACH_SPECIALIZATIONS[Math.floor(rng() * COACH_SPECIALIZATIONS.length)] : null;
    const { fee, salary } = await starPricing(stars, quality);
    out.push({
      id: `cand-${role}-${stars}-${i}`,
      role,
      stars,
      name: `${firstName} ${lastName}`,
      specialization,
      quality,
      hireFee: fee,
      salary,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const clubId = req.nextUrl.searchParams.get("clubId");
  if (!clubId) return fail("VALIDATION_ERROR", "clubId query parameter is required", 400);

  const access = await getClubAccess(auth.userId, clubId);
  const guard = clubAccessError(access);
  if (guard) return fail(guard.code, guard.message, guard.status);

  const day = await currentGameDay();
  const [staff, facilities, maxPerRole] = await Promise.all([
    db.staffMember.findMany({ where: { clubId }, orderBy: [{ role: "asc" }, { quality: "desc" }] }),
    db.facility.findMany({ where: { clubId }, select: { type: true, level: true } }),
    getInt("staff.maxPerRole", 3),
  ]);
  const levelOf = (type: string) => facilities.find((f) => f.type === type)?.level ?? 1;

  const areas = (STAFF_ROLES as readonly StaffRole[]).map((role) => {
    const facilityType = AREA_FACILITY[role];
    const facilityLevel = levelOf(facilityType);
    return {
      role,
      facilityType,
      facilityLevel,
      maxStars: maxStarsForFacility(facilityLevel),
      starRequirements: starRequirements(),
    };
  });

  const counts: Record<string, number> = {};
  for (const s of staff) counts[s.role] = (counts[s.role] ?? 0) + 1;

  return ok({
    clubId,
    day,
    staff: staff.map((s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      specialization: s.specialization,
      quality: s.quality,
      salary: s.salary,
      createdAt: s.createdAt.toISOString(),
    })),
    areas,
    counts,
    config: { maxPerRole, hireCostPerQuality: await getInt("staff.hireCostPerQuality", 2), day, severanceMultiplier: await getInt("staff.severanceMultiplier", 2) },
  });
}
