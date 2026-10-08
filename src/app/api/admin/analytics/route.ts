// Knight FM — Knight Control Center: product analytics (30-day counts by event name + landing funnel).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";

// Canonical landing→game funnel steps (matched against whatever events actually exist).
const FUNNEL_STEPS = [
  "landing_view",
  "landing_cta_click",
  "auth_register_start",
  "auth_register_success",
  "auth_login_success",
  "onboarding_path_selected",
  "onboarding_complete",
];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const since = new Date(Date.now() - 30 * 86400_000);

  const grouped = await db.analyticsEvent.groupBy({
    by: ["name"],
    where: { createdAt: { gte: since } },
    _count: { name: true },
    orderBy: { _count: { name: "desc" } },
  });

  const countByName = new Map(grouped.map((g) => [g.name, g._count.name]));
  const funnel = FUNNEL_STEPS.map((step) => ({ step, count: countByName.get(step) ?? 0 }))
    .filter((f) => f.count > 0 || FUNNEL_STEPS.indexOf(f.step) < 3);

  const total = grouped.reduce((acc, g) => acc + g._count.name, 0);

  return ok({
    windowDays: 30,
    total,
    byName: grouped.map((g) => ({ name: g.name, count: g._count.name })),
    funnel,
  });
}
