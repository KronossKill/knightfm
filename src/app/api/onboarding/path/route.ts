// Knight FM — POST /api/onboarding/path.
// Persists the user's chosen career path (MANAGER | OWNER). The choice only
// becomes FINAL once a club is managed or owned: while the user is club-less
// they may re-decide freely (the onboarding always shows both options again).

import { NextRequest } from "next/server";
import { ok, fail, audit, clientIp, requireAuth, isResponse, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { z } from "@/app/api/auth/_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ path: z.enum(["MANAGER", "OWNER"]) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const user = await db.user.findUnique({ where: { id: auth.userId }, select: { path: true } });
  if (!user) return fail("NOT_FOUND", "User not found", 404);

  const [managedClub, ownedCount] = await Promise.all([
    db.club.findFirst({ where: { managerId: auth.userId }, select: { id: true } }),
    db.club.count({ where: { ownerId: auth.userId } }),
  ]);
  if (managedClub || ownedCount > 0) {
    return fail("PATH_LOCKED", "Career path locked: a club is already managed or owned", 409);
  }

  const previousPath = user.path;
  await db.user.update({ where: { id: auth.userId }, data: { path: parsed.data.path } });
  await audit("ONBOARDING_PATH", auth.userId, {
    path: parsed.data.path,
    previousPath: previousPath ?? undefined,
    changed: previousPath !== parsed.data.path,
    ip: clientIp(req),
  });

  return ok({ path: parsed.data.path });
}
