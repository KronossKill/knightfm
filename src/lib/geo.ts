// Knight FM — Country resolution for connected users (Task 67, USER MANDATE).
//
// GOAL: every connected manager has a country so the presence gadget shows
// flags and the admin IP audit shows where accounts connect from.
//
// Resolution strategy (cheap → expensive, cached):
//   1. Edge geo headers — FREE and authoritative on the production host:
//        - `x-vercel-ip-country` (Vercel injects it at the edge; clients cannot
//          spoof it — Vercel strips/overwrites client-supplied values)
//        - `cf-ipcountry` (Cloudflare, same guarantees when deployed behind it)
//   2. Public geo API fallback (self-hosted / local dev / direct origins),
//      with an in-memory cache so each IP costs ONE lookup per week:
//        country.is → ipwho.is → ip-api.com   (3s timeout each, first hit wins)
//
// FAILURE POLICY: geo is observability, never a gate. Every helper is written
// so a missing/unreachable provider yields NULL (no flag), never an error that
// could break a login or a heartbeat. Private/local IPs are never resolved.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";

const ISO2_RE = /^[A-Za-z]{2}$/;

/** Country from the platform edge headers, or null. Sync + free. */
export function headerCountry(req: NextRequest): string | null {
  for (const key of ["x-vercel-ip-country", "cf-ipcountry"]) {
    const v = req.headers.get(key)?.trim();
    if (v && ISO2_RE.test(v)) return v.toUpperCase();
    // Some edge nodes send "XX"/"T1" sentinels for unknown — ISO2_RE rejects them.
  }
  return null;
}

/** True for loopback/RFC1918/link-local/CGNAT and the app's synthetic "local". */
export function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "local") return true;
  if (ip.includes(":")) {
    // IPv6 — loopback, link-local, unique-local, unspecified.
    const v6 = ip.toLowerCase();
    return (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80:") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    );
  }
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return true; // not a parseable IPv4 → do not query external APIs
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return a >= 224; // multicast/reserved
}

// ── In-memory per-process cache: 1 external lookup per IP per TTL ──

interface CacheEntry {
  country: string | null;
  at: number;
}
const CACHE = new Map<string, CacheEntry>();
const HIT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // resolved country: 7 days
const MISS_TTL_MS = 24 * 60 * 60 * 1000; // unresolved: retry once a day
const CACHE_MAX = 5_000; // hard cap; presence-sized world never approaches this

function cacheGet(ip: string): string | null | undefined {
  const e = CACHE.get(ip);
  if (!e) return undefined;
  const ttl = e.country ? HIT_TTL_MS : MISS_TTL_MS;
  if (Date.now() - e.at > ttl) {
    CACHE.delete(ip);
    return undefined;
  }
  return e.country;
}

function cacheSet(ip: string, country: string | null): void {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest !== undefined) CACHE.delete(oldest);
  }
  CACHE.set(ip, { country, at: Date.now() });
}

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3_000),
      headers: { "User-Agent": "KnightFM/1.0 (geo resolution)" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** One public-IP → ISO2 attempt across the provider chain. Never throws. */
async function lookupCountryExternal(ip: string): Promise<string | null> {
  const providers: (() => Promise<string | null>)[] = [
    // country.is → {"ip":"1.2.3.4","country":"ES"} ("-" when unknown)
    async () => {
      const j = await fetchJson(`https://get.country.is/${ip}`);
      const c = typeof j?.country === "string" ? j.country : null;
      return c && ISO2_RE.test(c) ? c.toUpperCase() : null;
    },
    // ipwho.is → {"success":true,"country_code":"ES"}
    async () => {
      const j = await fetchJson(`https://ipwho.is/${ip}`);
      const c = typeof j?.country_code === "string" ? j.country_code : null;
      return c && ISO2_RE.test(c) ? c.toUpperCase() : null;
    },
    // ip-api.com (HTTP on the free tier — fine for server-side calls)
    async () => {
      const j = await fetchJson(`http://ip-api.com/json/${ip}?fields=countryCode`);
      const c = typeof j?.countryCode === "string" ? j.countryCode : null;
      return c && ISO2_RE.test(c) ? c.toUpperCase() : null;
    },
  ];
  for (const p of providers) {
    const c = await p();
    if (c) return c;
  }
  return null;
}

/**
 * Full resolution for a request: edge headers first (production path — free),
 * then the cached external lookup (only for public IPs). Never throws.
 */
export async function resolveCountry(req: NextRequest, ip: string): Promise<string | null> {
  try {
    const fromHeader = headerCountry(req);
    if (fromHeader) return fromHeader;
    if (isPrivateIp(ip)) return null;
    const cached = cacheGet(ip);
    if (cached !== undefined) return cached;
    const resolved = await lookupCountryExternal(ip);
    cacheSet(ip, resolved);
    return resolved;
  } catch {
    return null;
  }
}

/**
 * Write-through: stamp the resolved country onto the (account, IP) evidence
 * row. Fire-and-forget by design — callers may `void` it; failures are logged
 * and swallowed. Only writes when the stored value differs (cheap no-op else).
 */
export async function persistIpCountry(userId: string, ip: string, country: string | null): Promise<void> {
  if (!userId || !ip || !country) return;
  try {
    await db.ipLink.updateMany({
      where: { userId, ip, country: { not: country } },
      data: { country },
    });
  } catch (err) {
    // Pre-migration databases (column missing) land here — geo is optional.
    console.error("[geo] persistIpCountry failed", err instanceof Error ? err.message : err);
  }
}

// ── Online flags aggregation ──────────────────────────────────────────

export interface OnlineFlag {
  /** ISO 3166-1 alpha-2, uppercase. */
  c: string;
  /** Connected managers from that country. */
  n: number;
}

/**
 * Countries currently online (5-minute presence window), most connections
 * first, capped at 8 flags. Degrades to [] when the country column does not
 * exist yet (pre-migration deploy) so the counter never breaks.
 */
export async function onlineFlags(): Promise<OnlineFlag[]> {
  try {
    const since = new Date(Date.now() - 5 * 60_000);
    const rows = await db.presence.groupBy({
      by: ["country"],
      where: { lastSeenAt: { gte: since }, country: { not: null } },
      _count: { _all: true },
    });
    return rows
      .map((r) => ({ c: r.country as string, n: r._count._all }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8);
  } catch {
    return [];
  }
}
