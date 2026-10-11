// Knight FM — GeoIP: country of the connection IP (Task 50, USER MANDATE).
// "Los usuarios se muestran con la bandera del país donde se están conectando."
//
// • lookupCountryCode(ip) resolves a public IP to an ISO-3166 alpha-2 country
//   code via a free GeoIP HTTP endpoint, with an in-memory TTL cache (1 day per
//   IP) so repeated sign-ins/heartbeats never hammer the provider.
// • Private/loopback/local addresses and resolution failures map to "" —
//   honest UNKNOWN, never a guessed country.
// • Never throws: evidence collection must not break a sign-in (same policy as
//   recordIpLink). A 4-second ceiling keeps it off the hot path.
// • countryFlag(code) turns an ISO code into its emoji flag (regional indicator
//   symbols — no dependency, no image assets). "" → "🏴" (unknown).

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { code: string; at: number }>();

/** IPv4/IPv6 private, loopback, link-local or otherwise non-public. */
export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return !ip.includes("."); // bare hostnames are not IPs
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

async function fetchCountry(ip: string): Promise<string> {
  // ip-api.com free endpoint: no key, HTTP only, 45 req/min — fine at cached rates.
  const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode`, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!res.ok) return "";
  const body = (await res.json()) as { status?: string; countryCode?: string };
  if (body.status !== "success" || typeof body.countryCode !== "string") return "";
  const code = body.countryCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : "";
}

/** Resolve the ISO-3166 alpha-2 code for a public IP (cached, fail-open ""). */
export async function lookupCountryCode(ip: string): Promise<string> {
  if (isPrivateIp(ip)) return "";
  const hit = cache.get(ip);
  if (hit && Date.now() - hit.at < TTL) return hit.code;
  try {
    const code = await fetchCountry(ip);
    cache.set(ip, { code, at: Date.now() });
    return code;
  } catch {
    // Do not cache failures — retry on the next sign-in.
    return "";
  }
}

/** ISO-3166 alpha-2 → emoji flag ("", invalid → unknown flag 🏴). */
export function countryFlag(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "🏴";
  const base = 0x1f1e6;
  const up = code.toUpperCase();
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}
