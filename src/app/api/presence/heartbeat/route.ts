// Knight FM — Presence heartbeat (D-009): 60s polling, 5-minute online window.
// Task 67 (USER MANDATE): every heartbeat also resolves the sender's country
// (edge geo headers → cached public geo API), stamps it onto the Presence
// snapshot and the IpLink evidence, and returns the aggregated online flags.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse, clientIp } from "@/lib/api";
import { resolveCountry, persistIpCountry, onlineFlags } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const now = new Date();

  // Geo is observability — it must NEVER break the heartbeat. resolveCountry
  // never throws; the country write degrades to the legacy upsert on a
  // pre-migration database (column missing).
  const ip = clientIp(req);
  const country = await resolveCountry(req, ip);
  void persistIpCountry(auth.userId, ip, country);

  try {
    await db.presence.upsert({
      where: { userId: auth.userId },
      create: country ? { userId: auth.userId, lastSeenAt: now, country } : { userId: auth.userId, lastSeenAt: now },
      update: country ? { lastSeenAt: now, country } : { lastSeenAt: now },
    });
  } catch (err) {
    if (!country) throw err;
    // Migration not applied yet (Presence.country missing) — keep the
    // pre-Task-68 behavior so the online counter keeps working.
    console.error("[presence] country write failed — legacy heartbeat", err instanceof Error ? err.message : err);
    await db.presence.upsert({
      where: { userId: auth.userId },
      create: { userId: auth.userId, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
  }

  const online = await db.presence.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - 5 * 60_000) } } });
  const flags = await onlineFlags();
  return ok({ online, flags, at: now.toISOString() });
}
