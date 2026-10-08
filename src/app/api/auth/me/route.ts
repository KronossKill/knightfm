// Knight FM — GET /api/auth/me.
// Returns the authenticated user's profile: identity, wallet balance, owned
// clubs (with brand + region/division), managed club with its active contract
// summary, and unread notification count.

import { NextRequest } from "next/server";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    include: {
      wallet: { select: { balance: true } },
      clubsOwned: {
        include: {
          brand: true,
          region: { select: { index: true, nameKey: true } },
          division: { select: { index: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      notifications: { where: { readAt: null }, select: { id: true } },
    },
  });
  if (!user) return ok(null);

  const managedClub = await db.club.findFirst({
    where: { managerId: user.id },
    include: {
      brand: true,
      region: { select: { index: true, nameKey: true } },
      division: { select: { index: true } },
    },
  });

  let contract: { dailySalary: number; endDay: number; state: string } | null = null;
  if (managedClub) {
    const active = await db.managerContract.findFirst({
      where: { clubId: managedClub.id, managerId: user.id, state: "ACTIVE" },
      select: { dailySalary: true, endDay: true, state: true },
    });
    contract = active ?? null;
  }

  const brandView = (b: { primaryColor: string; secondaryColor: string; badgeShape: string; initials: string } | null) =>
    b
      ? { primaryColor: b.primaryColor, secondaryColor: b.secondaryColor, badgeShape: b.badgeShape, initials: b.initials }
      : null;

  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    path: user.path,
    locale: user.locale,
    theme: user.theme,
    emailVerified: user.emailVerified,
    wallet: { balance: user.wallet?.balance ?? 0 },
    clubsOwned: user.clubsOwned.map((c) => ({
      id: c.id,
      name: c.name,
      brand: brandView(c.brand),
      regionIndex: c.region.index,
      regionNameKey: c.region.nameKey,
      divisionIndex: c.division.index,
    })),
    managedClub: managedClub
      ? {
          id: managedClub.id,
          name: managedClub.name,
          brand: brandView(managedClub.brand),
          regionIndex: managedClub.region.index,
          regionNameKey: managedClub.region.nameKey,
          divisionIndex: managedClub.division.index,
          contract,
        }
      : null,
    unreadNotifications: user.notifications.length,
  });
}
