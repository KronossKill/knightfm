// Knight FM — IP → country resolution (USER MANDATE: "Los usuarios se muestran
// con la bandera del país donde se están conectando").
//
// Design (honest + production-safe):
//   - Private/loopback IPs (preview panels, office NATs) resolve to null — no
//     fabricated countries.
//   - Results are cached in the IpGeo table (30-day TTL) so external geo
//     services are contacted once per IP, not per request.
//   - Resolver order: the operator-configured endpoint (security.geo.detectUrl,
//     GET {url}?ip= must answer JSON {country|country_code|countryCode}), then
//     the public ipwho.is service. Both calls are short-timeout and fail-open:
//     on any error the caller gets null and the UI simply hides the flag.
//   - Unresolvable IPs are never cached (they are retried on a later sign-in
//     once the network path works) — but a per-IP in-flight + negative cache
//     (15 min) prevents hammering a dead resolver.
//   - Everything runs best-effort: this is cosmetic telemetry and must NEVER
//     break a sign-in (all failures swallowed after logging).

import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

const CACHE_TTL_MS = 30 * 86400_000; // refresh cached rows after 30 days
const NEGATIVE_TTL_MS = 15 * 60_000; // don't re-probe a failed IP for 15 min

const privateCache = new Map<string, { code: string | null; at: number }>();

/** Loopback / private / link-local ranges → not geolocatable. */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip === "::ffff:127.0.0.1" || ip.startsWith("127.") || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("169.254.")) return true;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip === "::") return true; // IPv6 ULA / any
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));
  return false;
}

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

async function probe(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(3500), headers: { "User-Agent": "KnightFM/1.0 (geo)" } });
  if (!res.ok) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("json")) {
    const body = (await res.json()) as Record<string, unknown>;
    // CODE fields first: `country` on some services is the full NAME
    // (ipwho.is → country:"Argentina", country_code:"AR").
    return normalizeCode(body.country_code ?? body.countryCode ?? body.country);
  }
  const text = (await res.text()).trim();
  return normalizeCode(text);
}

/** Best-effort country code (ISO-3166 alpha-2, uppercase) for an IP, or null. */
export async function resolveCountryCode(ip: string | null | undefined): Promise<string | null> {
  if (!ip || isPrivateIp(ip)) return null;

  const mem = privateCache.get(ip);
  if (mem && Date.now() - mem.at < (mem.code ? CACHE_TTL_MS : NEGATIVE_TTL_MS)) return mem.code;

  // DB cache (shared across workers/users)
  try {
    const row = await db.ipGeo.findUnique({ where: { ip } });
    if (row && Date.now() - row.checkedAt.getTime() < CACHE_TTL_MS) {
      privateCache.set(ip, { code: row.countryCode, at: Date.now() });
      return row.countryCode;
    }
  } catch {
    // cache miss on error — continue to probing
  }

  let code: string | null = null;
  let source = "detectUrl";
  try {
    const detectUrl = await getConfig("security.geo.detectUrl");
    if (detectUrl && detectUrl.startsWith("https://")) {
      code = await probe(`${detectUrl}${detectUrl.includes("?") ? "&" : "?"}ip=${encodeURIComponent(ip)}`);
    }
  } catch {
    code = null;
  }
  if (!code) {
    source = "ipwho";
    try {
      code = await probe(`https://ipwho.is/${encodeURIComponent(ip)}`);
    } catch {
      code = null;
    }
  }

  privateCache.set(ip, { code, at: Date.now() });

  if (code) {
    try {
      await db.ipGeo.upsert({
        where: { ip },
        create: { ip, countryCode: code, source, checkedAt: new Date() },
        update: { countryCode: code, source, checkedAt: new Date() },
      });
    } catch {
      // non-fatal
    }
  }
  return code;
}

/**
 * Called from the same places that stamp lastLoginIp (sign-in, refresh,
 * heartbeat): persists User.lastCountry when the IP is new for the account or
 * the country was never resolved. Never throws.
 */
export async function updateUserCountry(userId: string, ip: string): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { lastCountry: true, lastLoginIp: true } });
    if (!user) return;
    // Probe only when needed: unknown country or the connection IP changed.
    if (user.lastCountry && user.lastLoginIp === ip) return;
    const code = await resolveCountryCode(ip);
    if (!code) return;
    if (user.lastCountry !== code) {
      await db.user.update({ where: { id: userId }, data: { lastCountry: code } });
    }
  } catch (err) {
    console.error("[geo] updateUserCountry failed", err instanceof Error ? err.message : err);
  }
}
