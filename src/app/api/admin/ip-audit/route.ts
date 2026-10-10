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
// Task 67 (USER MANDATE): every IP answer now carries its resolved country
// (from the IpLink evidence rows) so the admin sees WHERE connections come from.

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

/**
 * ip → most recently seen non-null country from the IpLink evidence rows.
 * Degrades to an empty map on pre-migration databases (country column absent).
 */
async function countriesForIps(ips: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ips.length === 0) return map;
  try {
    const rows = await db.ipLink.findMany({
      where: { ip: { in: ips }, country: { not: null } },
      orderBy: { lastSeenAt: "desc" },
      select: { ip: true, country: true },
    });
    for (const r of rows) {
      if (r.country && !map.has(r.ip)) map.set(r.ip, r.country);
    }
  } catch {
    // country column missing yet — flags stay empty, audit still works.
  }
  return map;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const ip = (req.nextUrl.searchParams.get("ip") ?? "").trim().slice(0, 60);

  if (ip.length > 0) {
    const [accounts, countries] = await Promise.all([
      db.user.findMany({
        where: { OR: [{ registrationIp: ip }, { lastLoginIp: ip }] },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: USER_SELECT,
      }),
      countriesForIps([ip]),
    ]);
    return ok({ mode: "ip" as const, ip, ipCountry: countries.get(ip) ?? null, accounts });
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
  const countries = await countriesForIps(sharedRaw.map((r) => r.ip));
  const sharedLoginIps = sharedRaw.map((r) => ({
    ip: r.ip,
    accounts: Number(r.accounts),
    country: countries.get(r.ip) ?? null,
  }));

  return ok({ mode: "summary" as const, sharedLoginIps, legacyUsersWithoutIp: legacy, totalUsers: total });
}
