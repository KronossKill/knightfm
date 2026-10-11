// Knight FM — Weekly payroll cron endpoint (Task 77, user mandate).
// Schedule: EVERY SUNDAY at 01:00 SERVER TIME. The server clock is UTC-only
// (spec D-002), and Vercel Cron fires in UTC, so vercel.json declares
// "0 1 * * 0" = Sundays 01:00:00 UTC → exactly the mandated instant.
//
// SECURITY: requires a valid CRON_SECRET — sent by Vercel Cron automatically
// as `Authorization: Bearer <CRON_SECRET>` when the env var exists — via the
// internal `x-cron-secret` header convention, or an ADMIN session (sandbox
// verification). Nothing anonymous.
//
// IDEMPOTENCY: the payroll is recorded in JobRun (`SALARY-SUN:<date>`, UNIQUE)
// and the ledger uses per-club-per-day idempotency keys, so hitting this
// endpoint any number of times can never pay a Sunday twice — it only
// triggers payment that is genuinely DUE. `?preview=1` returns the schedule
// windows without moving money.

import { NextRequest } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { ok, fail, rateLimit, clientIp, getAuth, isResponse } from "@/lib/api";
import { lastSunday0100Utc, nextSunday0100Utc, runWeeklySalaries } from "@/lib/engine/salary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SECURITY: constant-time comparison via digests (same hardening as the tick route).
function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

async function handle(req: NextRequest, preview: boolean) {
  const rl = rateLimit(`cron-salary:${clientIp(req)}`, 10, 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Limit reached. Retry in ${rl.retryAfterSec}s`, 429);

  // Guard: CRON_SECRET (Vercel Bearer or internal header) or ADMIN session.
  const cronSecret = process.env.CRON_SECRET;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const headerSecret = (req.headers.get("x-cron-secret") ?? "").trim();
  const viaCron =
    !!cronSecret &&
    ((bearer.length > 0 && secretsMatch(bearer, cronSecret)) ||
      (headerSecret.length > 0 && secretsMatch(headerSecret, cronSecret)));
  if (!viaCron) {
    const auth = await getAuth(req);
    if (isResponse(auth) || !auth || auth.role !== "ADMIN") {
      return fail("UNAUTHORIZED", "Payroll endpoint requires CRON_SECRET or an ADMIN session", 401);
    }
  }

  if (preview) {
    const now = new Date();
    return ok({
      schedule: "Every Sunday at 01:00 server time (UTC)",
      now: now.toISOString(),
      lastPaydayUtc: lastSunday0100Utc(now).toISOString(),
      nextPaydayUtc: nextSunday0100Utc(now).toISOString(),
    });
  }

  try {
    const result = await runWeeklySalaries();
    return ok({ ...result, at: new Date().toISOString() });
  } catch (e) {
    return fail("PAYROLL_FAILED", String(e).slice(0, 300), 500);
  }
}

export async function GET(req: NextRequest) {
  return handle(req, new URL(req.url).searchParams.get("preview") === "1");
}

export async function POST(req: NextRequest) {
  return handle(req, false);
}
