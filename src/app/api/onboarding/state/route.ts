// Knight FM — GET /api/onboarding/state.
// Onboarding progress for the authenticated user: chosen path, whether a club
// is already managed/owned, and whether the path choice is still pending.

import { NextRequest } from "next/server";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { path: true } });
  if (!user) return ok({ path: null, hasManagedClub: false, hasOwnedClub: false, needsPath: true, contractPreview: null });

  const [managedClub, ownedCount] = await Promise.all([
    db.club.findFirst({ where: { managerId: auth.userId }, select: { id: true } }),
    db.club.count({ where: { ownerId: auth.userId } }),
  ]);

  return ok({
    path: user.path,
    hasManagedClub: !!managedClub,
    hasOwnedClub: ownedCount > 0,
    needsPath: !user.path,
    contractPreview: null,
  });
}
