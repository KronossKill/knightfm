// Knight FM — health / readiness probe (AUDIT OBS-1).
// Unauthenticated, cheap, no maintenance gate: answers "is Knight FM alive?"
// and, when degraded, WHY (which dependency is failing). Safe for load
// balancers, uptime pingers and the external cron watchdog.

import { NextRequest } from "next/server";
import { ok } from "@/lib/api";
import { db } from "@/lib/db";
import { schedulerStatus } from "@/lib/engine/scheduler";

export async function GET(_req: NextRequest) {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  // 1. Database round-trip
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (e) {
    healthy = false;
    checks.db = { ok: false, error: String(e).slice(0, 120) };
  }

  if (checks.db && (checks.db as { ok: boolean }).ok) {
    // 2. World anchor present (a world without epoch cannot progress)
    try {
      const epochRow = await db.systemState.findUnique({ where: { key: "world.epoch.utc" } });
      const anchored = !!epochRow?.value;
      checks.world = { ok: anchored, anchored };
      if (!anchored) healthy = false;
    } catch {
      checks.world = { ok: false, anchored: false };
      healthy = false;
    }

    // 3. Scheduler freshness + due-match backlog
    try {
      const [lastDayRow, dueMatches] = await Promise.all([
        db.systemState.findUnique({ where: { key: "scheduler.lastDay" } }),
        db.fixture.count({ where: { status: "SCHEDULED", kickoffAt: { lte: new Date() } } }),
      ]);
      checks.scheduler = {
        ok: true,
        lastDay: lastDayRow ? parseInt(lastDayRow.value, 10) : null,
        dueMatches,
        ...schedulerStatus(),
      };
      if (dueMatches > 200) healthy = false; // engine is not keeping up
    } catch (e) {
      checks.scheduler = { ok: false, error: String(e).slice(0, 120) };
      healthy = false;
    }
  }

  return ok(
    {
      status: healthy ? "healthy" : "degraded",
      at: new Date().toISOString(),
      checks,
    },
    { status: healthy ? 200 : 503 }
  );
}
