// Knight FM — Scheduler tick (D-002): opportunistic catch-up trigger. The engine holds an
// in-process lock; the durable JobRun ledger makes every job idempotent. UTC only.
//
// SECURITY (pentest fix): this endpoint used to be ANONYMOUS — anyone could force engine
// runs (matches, salaries, settlements) at will. It now requires an ADMIN session or a
// matching CRON_SECRET header. Day-rollover does not depend on this route: /api/world/state
// opportunistically calls processDueJobs() for authenticated clients.

import { NextRequest } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { ok, fail, rateLimit, clientIp, getAuth, isResponse } from "@/lib/api";
import { processDueJobs } from "@/lib/engine/scheduler";

// SECURITY (pentest fix): non-constant-time string comparison leaks the secret
// byte-by-byte through timing. Compare digests instead.
function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`tick:${clientIp(req)}`, 30, 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Tick limit reached. Retry in ${rl.retryAfterSec}s`, 429);

  // Guard: ADMIN session or CRON_SECRET header. Nothing anonymous.
  const cronSecret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");
  if (provided && cronSecret && secretsMatch(provided, cronSecret)) {
    // authorized via cron
  } else {
    const auth = await getAuth(req);
    if (isResponse(auth) || !auth || auth.role !== "ADMIN") {
      return fail("UNAUTHORIZED", "Scheduler tick requires an ADMIN session or a valid x-cron-secret header", 401);
    }
  }

  try {
    const result = await processDueJobs();
    return ok({ ...result, at: new Date().toISOString() });
  } catch (e) {
    return ok({ processedDays: 0, matches: 0, error: String(e).slice(0, 300), at: new Date().toISOString() });
  }
}
