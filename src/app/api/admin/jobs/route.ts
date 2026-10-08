// Knight FM — Knight Control Center: scheduler job ledger (last 100 JobRun rows).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const rows = await db.jobRun.findMany({ orderBy: { scheduledFor: "desc" }, take: 100 });

  return ok({
    items: rows.map((j) => ({
      id: j.id, idempotencyKey: j.idempotencyKey, jobType: j.jobType,
      scheduledFor: j.scheduledFor, startedAt: j.startedAt, completedAt: j.completedAt,
      outcome: j.outcome, retryCount: j.retryCount, error: j.error,
    })),
  });
}
