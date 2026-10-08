// Knight FM — GET /api/admin/users (ADMIN only).
// User directory for the Control Center "Users" tab: search by email/username,
// optional role filter, with wallet balance and linked clubs (managed/owned) so
// the admin can promote/demote and credit funds without touching the DB.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const role = req.nextUrl.searchParams.get("role");
  const limit = Math.min(25, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 10) || 10));

  if (role && role !== "ADMIN" && role !== "USER") {
    return fail("VALIDATION_ERROR", "role must be ADMIN or USER", 400);
  }
  if (q.length > 0 && q.length < 2) {
    return fail("VALIDATION_ERROR", "Search term must be at least 2 characters", 400);
  }

  const where: Record<string, unknown> = {};
  if (role === "ADMIN" || role === "USER") where.role = role;
  if (q.length >= 2) {
    where.OR = [{ email: { contains: q } }, { username: { contains: q } }];
  }

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      emailVerified: true,
      path: true,
      createdAt: true,
      wallet: { select: { balance: true } },
      clubsManaged: { select: { id: true, name: true } },
      clubsOwned: { select: { id: true, name: true, operatingFund: true } },
    },
  });

  return ok({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      role: u.role,
      emailVerified: u.emailVerified,
      path: u.path,
      createdAt: u.createdAt.toISOString(),
      walletBalance: u.wallet?.balance ?? 0,
      managedClubs: u.clubsManaged,
      ownedClubs: u.clubsOwned,
    })),
  });
}
