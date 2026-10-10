// Knight FM — GET /api/user/geo (Task 53).
// Country of the CALLER's own connection, used by the CountryFlag shown to the
// right of the username in the game shell header.
//
// Resolution order (all free, most-reliable first):
//   1. Edge header country (cf-ipcountry from Cloudflare / x-vercel-ip-country
//      from Vercel) — instant, zero third-party calls when present.
//   2. Provider chain in src/lib/ip-geo.ts (ipwho.is → ipapi.co → ip-api.com),
//      in-memory cached 24 h per IP; private/local IPs answer "ZZ" on-server
//      and never reach any provider.
//
// Privacy: only the caller's own IP is involved, it is never persisted, and it
// is forwarded to at most one external provider solely to derive the country.

import { NextRequest } from "next/server";
import { fail, isResponse, ok, rateLimit, requireAuth } from "@/lib/api";
import { isValidIp, lookupCountry } from "@/lib/ip-geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** First syntactically valid client IP from the proxy headers, or null. */
function clientIpFromHeaders(req: NextRequest): string | null {
  // cf-connecting-ip is set (and can't be client-spoofed) when behind Cloudflare.
  const candidates: Array<string | null> = [
    req.headers.get("cf-connecting-ip"),
    // Left-most entry of XFF is the original client as seen by the first proxy.
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    req.headers.get("x-real-ip"),
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value && isValidIp(value)) return value;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  // One flag per shell render; generous ceiling anyway.
  const limited = rateLimit(`user-geo:${auth.userId}`, 30, 60_000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", `Too many geo requests; retry in ${limited.retryAfterSec}s`, 429);
  }

  // 1) Edge-provided country — free, instant, no provider call.
  const edge =
    (req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? "")
      .trim()
      .toUpperCase();
  // "XX" = unknown at the edge, "T1" = Tor exit (Cloudflare reserved code).
  if (/^[A-Z]{2}$/.test(edge) && edge !== "XX" && edge !== "T1") {
    return ok({ countryCode: edge, country: null });
  }

  // 2) Provider chain (cached). No resolvable public IP → honest unknown.
  const ip = clientIpFromHeaders(req);
  if (!ip) return ok({ countryCode: null, country: null });

  const geo = await lookupCountry(ip);
  return ok({ countryCode: geo.countryCode, country: geo.country });
}
