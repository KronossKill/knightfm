// Knight FM — Presence heartbeat (D-009): 60s polling, 5-minute online window.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const now = new Date();
  await db.presence.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, lastSeenAt: now },
    update: { lastSeenAt: now },
  });

  const online = await db.presence.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - 5 * 60_000) } } });
  return ok({ online, at: now.toISOString() });
}
