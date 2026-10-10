// Knight FM — server-side IP → country lookup (Task 52-b; upgraded Task 53).
//
// RELIABILITY (multi-provider fallback chain, all free tiers, no API keys):
//   1. Edge headers (cf-ipcountry / x-vercel-ip-country) — checked by the
//      calling route BEFORE reaching this lib: zero third-party calls when the
//      app sits behind Cloudflare or Vercel.
//   2. ipwho.is      — HTTPS, free, no key (~10k req/month).
//   3. ipapi.co      — HTTPS, free, no key (~1k req/day).
//   4. ip-api.com    — free, no key (HTTP; 45 req/min).
// The first provider that answers with a valid ISO 3166-1 alpha-2 code wins;
// if all fail the answer is honest "unknown" (never a guessed country).
//
// PRIVACY (honest note): a queried IP is sent to (at most) one third-party
// provider — the first one that answers — when a session flag or an admin
// lookup needs the connection country. Results are cached in memory for 24 h
// (transient failures retry after 5 min) so repeated views of the same address
// never re-send it. Private/local addresses (10/8, 172.16/12, 192.168/16,
// 127/8, ::1, fc00::/7) are classified locally and NEVER leave the server:
// they resolve to the reserved code "ZZ" / "Local network", which the UI maps
// to a local-network icon.

export interface IpGeoResult {
  countryCode: string | null;
  country: string | null;
}

const PROVIDER_TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // successes live 24 h
const FAILURE_TTL_MS = 5 * 60 * 1000; // transient provider failures retry sooner (no 24 h stickiness)
const CACHE_MAX_ENTRIES = 5000;

type CacheEntry = { at: number; value: IpGeoResult; failure: boolean };

// globalThis store so dev-server HMR does not silently split the cache.
const globalStore = globalThis as typeof globalThis & {
  __knightIpGeoCache?: Map<string, CacheEntry>;
};
const cache: Map<string, CacheEntry> = (globalStore.__knightIpGeoCache ??= new Map());

const NULL_RESULT: IpGeoResult = { countryCode: null, country: null };
const LOCAL_RESULT: IpGeoResult = { countryCode: "ZZ", country: "Local network" };

const IPV4_RE = /^(\d{1,3})(\.\d{1,3}){3}$/;
// Loose IPv6 gate: hex groups and colons only (the provider rejects garbage anyway).
const IPV6_RE = /^[0-9A-Fa-f:]{2,45}$/;

/** True when the string is a syntactically valid IPv4 or IPv6 address. */
export function isValidIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — validate the embedded dotted quad.
  if (/^::ffff:/i.test(ip)) return isValidIp(ip.slice(7));
  if (ip.includes(":")) return IPV6_RE.test(ip);
  if (!IPV4_RE.test(ip)) return false;
  return ip.split(".").every((o) => Number(o) <= 255);
}

function isPrivateOrLocalIp(ip: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) — inspect the embedded v4 instead.
  let candidate = ip;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped) candidate = mapped[1];

  if (candidate.includes(":")) {
    const v6 = candidate.toLowerCase();
    if (v6 === "::" || v6 === "::1") return true; // unspecified / loopback
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true; // fc00::/7 unique-local
    return false;
  }

  const octets = candidate.split(".").map(Number);
  if (octets.length !== 4) return false;
  const [a, b] = octets;
  if (a === 10 || a === 127 || a === 0) return true; // 10/8, 127/8, 0/8 (spec + "this host")
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 169 && b === 254) return true; // 169.254/16 link-local (no route out)
  return false;
}

function sweepCache(now: number) {
  if (cache.size === 0) return;
  // Simple sweep: drop expired entries, then trim oldest-first over the cap.
  for (const [key, entry] of cache) {
    if (now - entry.at >= (entry.failure ? FAILURE_TTL_MS : CACHE_TTL_MS)) cache.delete(key);
  }
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// ── Provider plumbing ─────────────────────────────────────────────

/** GET a JSON object with a hard timeout; null on any failure (never throws). */
async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null; // timeout (abort) or network error — swallowed on purpose
  } finally {
    clearTimeout(timer);
  }
}

function normalizeCountryCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cc = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cc) ? cc : null;
}

function normalizeCountryName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 100) : null;
}

type Provider = { name: string; lookup: (ip: string) => Promise<IpGeoResult | null> };

// Order = trust/privacy priority. Each lookup returns null on ANY problem so
// the chain can move on; they never throw.
const PROVIDERS: Provider[] = [
  {
    name: "ipwho.is",
    lookup: async (ip) => {
      const body = await fetchJson(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!body || body.success !== true) return null;
      const cc = normalizeCountryCode(body.country_code);
      return cc ? { countryCode: cc, country: normalizeCountryName(body.country) } : null;
    },
  },
  {
    name: "ipapi.co",
    lookup: async (ip) => {
      const body = await fetchJson(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
      if (!body || body.error === true || typeof body.error === "string") return null;
      const cc = normalizeCountryCode(body.country_code);
      return cc ? { countryCode: cc, country: normalizeCountryName(body.country_name) } : null;
    },
  },
  {
    name: "ip-api.com",
    lookup: async (ip) => {
      const body = await fetchJson(
        `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,country`,
      );
      if (!body || body.status !== "success") return null;
      const cc = normalizeCountryCode(body.countryCode);
      return cc ? { countryCode: cc, country: normalizeCountryName(body.country) } : null;
    },
  },
];

/**
 * Resolves the country for an IP via the provider fallback chain. NEVER
 * throws: on timeout, network failure, provider errors or an invalid/
 * unroutable address it returns { countryCode: null, country: null } (or the
 * ZZ local-network marker).
 */
export async function lookupCountry(ip: string): Promise<IpGeoResult> {
  try {
    if (!isValidIp(ip)) return NULL_RESULT; // never forward garbage to a third party
    if (isPrivateOrLocalIp(ip)) return LOCAL_RESULT; // stays on-server

    const now = Date.now();
    sweepCache(now);
    const hit = cache.get(ip);
    if (hit && now - hit.at < (hit.failure ? FAILURE_TTL_MS : CACHE_TTL_MS)) return hit.value;

    let result: IpGeoResult = NULL_RESULT;
    for (const provider of PROVIDERS) {
      const answer = await provider.lookup(ip);
      if (answer) {
        result = answer;
        break; // first provider that answers honestly wins
      }
    }

    cache.set(ip, { at: Date.now(), value: result, failure: result.countryCode === null });
    return result;
  } catch {
    return NULL_RESULT; // absolute guarantee: lookupCountry never rejects
  }
}
