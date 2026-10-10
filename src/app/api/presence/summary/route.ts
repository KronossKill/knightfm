// Knight FM — Public presence summary (D-009): online now + weekly/monthly/yearly
// distinct active users (Presence ∪ AnalyticsEvent). Counts only — no PII.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, rateLimit, clientIp, fail } from "@/lib/api";
import { onlineFlags } from "@/lib/geo";

async function distinctUsersSince(since: Date): Promise<number> {
  const [presences, events] = await Promise.all([
    db.presence.findMany({ where: { lastSeenAt: { gte: since } }, select: { userId: true } }),
    db.analyticsEvent.findMany({ where: { createdAt: { gte: since }, userId: { not: null } }, select: { userId: true }, distinct: ["userId"] }),
  ]);
  const ids = new Set<string>();
  for (const p of presences) ids.add(p.userId);
  for (const e of events) if (e.userId) ids.add(e.userId);
  return ids.size;
}

// SECURITY (pentest fix): this endpoint was public, unthrottled and scanned up
// to 365 days of Presence + AnalyticsEvent per call — an amplification vector
// (each anonymous request = 4 heavy full-table-ish scans). Per-IP rate limit
// added; response is cheap to fail with 429.
export async function GET(req: NextRequest) {
  const rl = rateLimit(`pres:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", "Too many requests", 429, { retryAfterSec: rl.retryAfterSec });

  const now = Date.now();
  const [online, flags] = await Promise.all([
    db.presence.count({ where: { lastSeenAt: { gte: new Date(now - 5 * 60_000) } } }),
    onlineFlags(),
  ]);

  const [weekly, monthly, yearly] = await Promise.all([
    distinctUsersSince(new Date(now - 7 * 86400_000)),
    distinctUsersSince(new Date(now - 30 * 86400_000)),
    distinctUsersSince(new Date(now - 365 * 86400_000)),
  ]);

  return ok({ online, weekly, monthly, yearly, flags, at: new Date(now).toISOString() });
}
