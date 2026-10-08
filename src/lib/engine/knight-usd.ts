// Knight FM — effective USD value of 1 $Knight (server-side resolver).
// Priority order (honest, never fabricates):
//   1. "oracle" — solana.price.url JSON price source (auto-detection, 5-minute
//      module cache, fail-open on any error/timeout).
//   2. "manual" — economy.knightUsdCents (admin-configured, Control Center).
//   3. null     — no USD equivalents are shown anywhere (clients hide them).
// Consumers: /api/world/state (public snapshot), /api/wallet/price (wallet card).

import { getConfig, getInt } from "@/lib/config";

export interface KnightUsdResult {
  /** Effective USD value of 1 $Knight in US cents, or null when unavailable. */
  cents: number | null;
  /** Where the value came from: detected price source or manual config. */
  source: "oracle" | "manual" | null;
}

/** Extracts a positive USD price from common JSON shapes; null when absent. */
export function parseUsdPrice(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  const candidates: unknown[] = [
    d.price,
    d.usd,
    (d.data as Record<string, unknown> | undefined)?.price,
    Array.isArray(d.pairs) && d.pairs.length > 0 ? (d.pairs[0] as Record<string, unknown>).price : undefined,
  ];
  for (const c of candidates) {
    const n = typeof c === "string" ? parseFloat(c) : typeof c === "number" ? c : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

const ORACLE_TTL_MS = 5 * 60_000;
let oracleCache: { usd: number; at: number; url: string } | null = null;

/** Fetches the configured price source (cached 5 min per URL, fail-open → null). */
export async function fetchOracleUsd(url: string): Promise<number | null> {
  const hit = oracleCache;
  if (hit && hit.url === url && Date.now() - hit.at < ORACLE_TTL_MS) return hit.usd;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const usd = parseUsdPrice(await res.json());
    if (usd != null) oracleCache = { usd, at: Date.now(), url };
    return usd;
  } catch {
    return null; // unreachable/timeout → fall through to the manual rate
  }
}

/** Resolves the effective KN→USD rate: oracle (detected) first, manual config second. */
export async function getKnightUsd(): Promise<KnightUsdResult> {
  const url = await getConfig("solana.price.url");
  if (url) {
    const usd = await fetchOracleUsd(url);
    if (usd != null) return { cents: Math.max(1, Math.round(usd * 100)), source: "oracle" };
  }
  const manual = await getInt("economy.knightUsdCents", 0);
  if (manual > 0) return { cents: manual, source: "manual" };
  return { cents: null, source: null };
}
