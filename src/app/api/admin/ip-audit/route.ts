// Knight FM — GET /api/admin/ip-audit (ADMIN only, read-only).
// ANTI-MULTICUENTA (Task 39, USER MANDATE): the platform enforces EXACTLY ONE
// account per IP at signup (UNIQUE registrationIp — the DB is the arbiter).
// This endpoint is the admin's oversight window:
//   ?ip=1.2.3.4  → every account that REGISTERED from that IP, plus every
//                  account whose LAST SIGN-IN came from it (roaming / shared
//                  device detection).
//   no params    → summary: IPs where 2+ accounts last signed in (the practical
//                  multi-account signal after the registration rule), the count
//                  of legacy users created before the rule existed, and totals.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  status: true,
  registrationIp: true,
  lastLoginIp: true,
  createdAt: true,
  lastActiveAt: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const ip = (req.nextUrl.searchParams.get("ip") ?? "").trim().slice(0, 60);

  if (ip.length > 0) {
    const accounts = await db.user.findMany({
      where: { OR: [{ registrationIp: ip }, { lastLoginIp: ip }] },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: USER_SELECT,
    });
    return ok({ mode: "ip" as const, ip, accounts });
  }

  const [sharedRaw, legacy, total] = await Promise.all([
    // $queryRaw (tagged template = parameterized, no injection): IPs where two
    // or more different accounts performed their last sign-in — the live
    // multi-account usage signal the admin can then drill into with ?ip=.
    db.$queryRaw<{ ip: string; accounts: bigint }[]>`
      SELECT "lastLoginIp" AS ip, COUNT(*) AS accounts
      FROM "User"
      WHERE "lastLoginIp" IS NOT NULL
      GROUP BY "lastLoginIp"
      HAVING COUNT(*) >= 2
      ORDER BY accounts DESC
      LIMIT 25`,
    db.user.count({ where: { registrationIp: null } }),
    db.user.count(),
  ]);

  // COUNT(*) arrives as BigInt from SQLite — JSON cannot serialize it.
  const sharedLoginIps = sharedRaw.map((r) => ({ ip: r.ip, accounts: Number(r.accounts) }));

  return ok({ mode: "summary" as const, sharedLoginIps, legacyUsersWithoutIp: legacy, totalUsers: total });
}
