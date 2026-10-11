// Knight FM — GET /api/admin/ip-geo?ip=x.x.x.x (ADMIN only, Task 52-b).
// On-demand country resolution for a single IP shown in the Control Center
// users panel. PRIVACY (honest note): the queried IP is forwarded to the geo
// provider (ip-api.com) ONLY when an admin explicitly requests it; results are
// cached in memory for 24 h (src/lib/ip-geo.ts). Private/local addresses never
// reach the provider — they answer "ZZ" / "Local network" from server-side
// classification, so an admin signed in from a local address also resolves.

import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, isResponse, ok, rateLimit, requireAuth } from "@/lib/api";
import { isValidIp, lookupCountry } from "@/lib/ip-geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  ip: z
    .string()
    .min(1)
    .max(45)
    .refine(isValidIp, "ip must be a valid IPv4 or IPv6 address"),
});

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const limited = rateLimit(`ip-geo:${auth.userId}`, 60, 60_000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", `Too many geo lookups; retry in ${limited.retryAfterSec}s`, 429);
  }

  const parsed = querySchema.safeParse({
    ip: (req.nextUrl.searchParams.get("ip") ?? "").trim(),
  });
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "ip must be a valid IPv4 or IPv6 address", 400);
  }

  const geo = await lookupCountry(parsed.data.ip);
  return ok({ countryCode: geo.countryCode, country: geo.country });
}
