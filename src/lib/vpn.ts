// Knight FM — VPN/proxy policy engine (Task 25-d).
// evidence-based VPN flagging on top of the security.vpnDetectUrl detector,
// an admin-managed VpnException allow-list (exact IPs + IPv4 CIDR) and a
// log_only|block policy switch (security.vpnPolicy).
//
// Design invariants:
// - Never block WITHOUT detector evidence (empty detectUrl → flagged=false).
// - Detector errors/timeout FAIL OPEN (never block because the detector broke).
// - The exception list is cached in memory for 60s so login/register/refresh
//   never hammer the DB; CRUD routes call invalidateVpnCache() on writes.
// - Legacy policy value "block_except_cuba" (and any future "block_*") is
//   treated as "block": per-IP exceptions are expressed through VpnException.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";

// ─── Config ───────────────────────────────────────────────────────

export interface VpnConfig {
  policy: string;
  detectUrl: string;
}

export async function loadVpnConfig(): Promise<VpnConfig> {
  const [policy, detectUrl] = await Promise.all([
    getConfig("security.vpnPolicy"),
    getConfig("security.vpnDetectUrl"),
  ]);
  return { policy: policy || "log_only", detectUrl: detectUrl || "" };
}

// Any value that starts with "block" means enforcement (covers "block" and the
// legacy "block_except_cuba" written before the exceptions table existed).
export function isBlockPolicy(policy: string): boolean {
  return policy.trim().toLowerCase().startsWith("block");
}

// ─── IP parsing / matching ────────────────────────────────────────

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Parses a dotted-quad IPv4 into an unsigned 32-bit int (null if invalid). */
export function parseIpv4(ip: string): number | null {
  const m = IPV4_RE.exec(ip);
  if (!m) return null;
  let out = 0;
  for (let i = 1; i <= 4; i++) {
    const octet = Number(m[i]);
    if (octet > 255) return null;
    out = out * 256 + octet;
  }
  return out >>> 0;
}

/** Exact IPv4 (each octet 0–255). */
export function isExactIpv4(value: string): boolean {
  return parseIpv4(value) !== null;
}

/**
 * Expands an IPv6 address into its 8 hex groups (4 hex digits each), or null
 * if it is not a syntactically valid IPv6 literal. Handles "::" compression.
 * Zone IDs ("%eth0") and embedded IPv4 tails are rejected (not needed here).
 */
export function parseIpv6Exact(value: string): string[] | null {
  if (!value.includes(":")) return null;
  if (!/^[0-9a-fA-F:]+$/.test(value)) return null;
  const parts = value.split("::");
  if (parts.length > 2) return null;
  const groupsOf = (s: string): string[] | null => {
    if (s === "") return [];
    const groups = s.split(":");
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    }
    return groups;
  };
  let groups: string[];
  if (parts.length === 2) {
    const left = groupsOf(parts[0]);
    const right = groupsOf(parts[1]);
    if (left === null || right === null) return null;
    const explicit = left.length + right.length;
    if (explicit > 7) return null; // "::" must replace at least one group
    const zeros = new Array(8 - explicit).fill("0");
    groups = [...left, ...zeros, ...right];
  } else {
    const single = groupsOf(parts[0]);
    if (single === null || single.length !== 8) return null;
    groups = single;
  }
  return groups.map((g) => g.padStart(4, "0"));
}

/** Exact IPv6 literal. */
export function isExactIpv6(value: string): boolean {
  return parseIpv6Exact(value) !== null;
}

/**
 * A storable exception value: exact IPv4, exact IPv6 or an IPv4 CIDR
 * (a.b.c.d/0..32). IPv6 prefixes are matched best-effort by isIpInCidr but are
 * intentionally NOT accepted here (spec: CIDR v4 only).
 */
export function isValidVpnValue(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 64) return false;
  const slash = v.indexOf("/");
  if (slash === -1) return isExactIpv4(v) || isExactIpv6(v);
  const prefix = Number(v.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const base = v.slice(0, slash);
  // Reject a second slash (e.g. "1.2.3.4/8/8") or stray characters.
  if (base.includes("/") || !/^[0-9./]+$/.test(v)) return false;
  return isExactIpv4(base);
}

/** IPv6 prefix match (best-effort): compares the top `prefix` bits. */
function ipv6PrefixMatch(ipGroups: string[], cidrGroups: string[], prefix: number): boolean {
  let remaining = prefix;
  for (let i = 0; i < 8 && remaining > 0; i++) {
    const bits = Math.min(16, remaining);
    const mask = bits === 16 ? 0xffff : (0xffff << (16 - bits)) & 0xffff;
    const a = parseInt(ipGroups[i], 16) & mask;
    const b = parseInt(cidrGroups[i], 16) & mask;
    if (a !== b) return false;
    remaining -= bits;
  }
  return true;
}

/**
 * True when `ip` falls inside `cidr`. `cidr` may be:
 * - an exact IPv4 / IPv6 literal (string or normalized equality), or
 * - an IPv4 CIDR (a.b.c.d/0..32) — exact bit-mask semantics, or
 * - an IPv6 prefix (2001:db8::/32) — best-effort top-bits comparison.
 */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const target = cidr.trim();
  if (target.length === 0 || ip.length === 0) return false;
  const slash = target.indexOf("/");
  const base = slash === -1 ? target : target.slice(0, slash);

  if (slash === -1) {
    // Exact value: fast path, then numeric/normalized equality.
    if (ip === base) return true;
    const a4 = parseIpv4(ip);
    const b4 = parseIpv4(base);
    if (a4 !== null && b4 !== null) return a4 === b4;
    const a6 = parseIpv6Exact(ip);
    const b6 = parseIpv6Exact(base);
    if (a6 && b6) return a6.join("") === b6.join("");
    return false;
  }

  const prefix = Number(target.slice(slash + 1));
  if (!Number.isInteger(prefix) || prefix < 0) return false;

  const ipV4 = parseIpv4(ip);
  const baseV4 = parseIpv4(base);
  if (ipV4 !== null && baseV4 !== null) {
    if (prefix > 32) return false;
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (ipV4 & mask) === (baseV4 & mask);
  }

  // IPv6 (best-effort prefix support).
  if (ipV4 === null && baseV4 === null) {
    if (prefix > 128) return false;
    const ipG = parseIpv6Exact(ip);
    const baseG = parseIpv6Exact(base);
    if (!ipG || !baseG) return false;
    return ipv6PrefixMatch(ipG, baseG, prefix);
  }
  return false; // family mismatch (v4 IP vs v6 range or vice-versa)
}

// ─── Data access (delegate-first, raw-SQL fallback) ───────────────
// A long-running `next dev` process can hold a PrismaClient generated BEFORE
// the VpnException migration (the client is a globalThis singleton, so hot
// reloads keep the stale instance). In such a process `db.vpnException` does
// not exist yet. Both access paths below target the SAME migrated SQLite
// table; the typed delegates take over automatically after a server restart.

export interface VpnExceptionRow {
  id: string;
  value: string;
  note: string;
  createdBy: string;
  createdAt: string; // ISO 8601
}

function vpnDelegate(): any | null {
  const delegate = (db as unknown as Record<string, unknown>)["vpnException"];
  return delegate && typeof (delegate as { findMany?: unknown }).findMany === "function" ? delegate : null;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function serializeRow(r: Record<string, unknown>): VpnExceptionRow {
  return {
    id: String(r.id),
    value: String(r.value),
    note: String(r.note ?? ""),
    createdBy: String(r.createdBy ?? ""),
    createdAt: toIso(r.createdAt),
  };
}

export async function vpnListValues(): Promise<string[]> {
  const delegate = vpnDelegate();
  if (delegate) {
    const rows = (await delegate.findMany({ select: { value: true } })) as { value: string }[];
    return rows.map((r) => r.value);
  }
  const raw = await db.$queryRawUnsafe<{ value: string }[]>("SELECT value FROM VpnException");
  return raw.map((r) => r.value);
}

export async function vpnListAll(): Promise<VpnExceptionRow[]> {
  const delegate = vpnDelegate();
  if (delegate) {
    const rows = (await delegate.findMany({ orderBy: { createdAt: "desc" } })) as Record<string, unknown>[];
    return rows.map(serializeRow);
  }
  const raw = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT id, value, note, createdBy, createdAt FROM VpnException ORDER BY createdAt DESC"
  );
  return raw.map(serializeRow);
}

export async function vpnFindByValue(value: string): Promise<VpnExceptionRow | null> {
  const delegate = vpnDelegate();
  if (delegate) {
    const row = (await delegate.findUnique({ where: { value } })) as Record<string, unknown> | null;
    return row ? serializeRow(row) : null;
  }
  const raw = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT id, value, note, createdBy, createdAt FROM VpnException WHERE value = ? LIMIT 1",
    value
  );
  return raw.length > 0 ? serializeRow(raw[0]) : null;
}

export async function vpnUpsert(value: string, note: string, createdBy: string): Promise<VpnExceptionRow> {
  const delegate = vpnDelegate();
  if (delegate) {
    const row = (await delegate.upsert({
      where: { value },
      create: { value, note, createdBy },
      update: { note },
    })) as Record<string, unknown>;
    return serializeRow(row);
  }
  await db.$executeRawUnsafe(
    "INSERT INTO VpnException (id, value, note, createdBy, createdAt) VALUES (?, ?, ?, ?, ?) " +
      "ON CONFLICT(value) DO UPDATE SET note = excluded.note",
    randomUUID(),
    value,
    note,
    createdBy,
    new Date().toISOString()
  );
  const row = await vpnFindByValue(value);
  if (!row) throw new Error("vpnUpsert: row disappeared after upsert");
  return row;
}

export async function vpnFindById(id: string): Promise<VpnExceptionRow | null> {
  const delegate = vpnDelegate();
  if (delegate) {
    const row = (await delegate.findUnique({ where: { id } })) as Record<string, unknown> | null;
    return row ? serializeRow(row) : null;
  }
  const raw = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    "SELECT id, value, note, createdBy, createdAt FROM VpnException WHERE id = ? LIMIT 1",
    id
  );
  return raw.length > 0 ? serializeRow(raw[0]) : null;
}

/** Returns true when a row was actually deleted. */
export async function vpnDeleteById(id: string): Promise<boolean> {
  const delegate = vpnDelegate();
  if (delegate) {
    await delegate.delete({ where: { id } });
    return true;
  }
  const affected = await db.$executeRawUnsafe("DELETE FROM VpnException WHERE id = ?", id);
  return affected > 0;
}

// ─── Exception allow-list (60s in-memory cache) ───────────────────

const VPN_CACHE_TTL_MS = 60_000;
let vpnCache: { at: number; values: Map<string, true> } | null = null;

/** Clears the cached exception list. Called by the CRUD routes after writes. */
export function invalidateVpnCache() {
  vpnCache = null;
}

/** True when the IP matches any VpnException row (exact value or CIDR). */
export async function isExcepted(ip: string): Promise<boolean> {
  if (!ip) return false;
  if (!vpnCache || Date.now() - vpnCache.at >= VPN_CACHE_TTL_MS) {
    const values = await vpnListValues();
    vpnCache = { at: Date.now(), values: new Map(values.map((v) => [v, true as const])) };
  }
  for (const value of vpnCache.values.keys()) {
    if (isIpInCidr(ip, value)) return true;
  }
  return false;
}

// ─── Detector ─────────────────────────────────────────────────────

/**
 * Asks the configured security.vpnDetectUrl endpoint: GET {url}?ip={ip} must
 * return JSON {"vpn": true|false}. Empty URL → false (there is never evidence
 * without a detector). Any error, timeout (3s) or unexpected payload fails
 * OPEN: the user is never blocked because the detector misbehaved.
 */
export async function detectVpn(ip: string): Promise<boolean> {
  const detectUrl = (await getConfig("security.vpnDetectUrl")).trim();
  if (!detectUrl) return false;

  const url = `${detectUrl}${detectUrl.includes("?") ? "&" : "?"}ip=${encodeURIComponent(ip)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`detector responded ${res.status}`);
    const data = (await res.json()) as { vpn?: unknown };
    return data?.vpn === true;
  } catch (err) {
    console.warn("[vpn] detector failed (fail-open):", err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Evaluation ───────────────────────────────────────────────────

export interface VpnEvaluation {
  flagged: boolean;
  excepted: boolean;
  blocked: boolean;
  policy: string;
}

/**
 * Full policy evaluation for an IP. blocked = block-policy AND detector
 * evidence AND not on the exception list. Only the `blocked` outcome is
 * enforced by routes; flagged&&!blocked is logged (VPN_LOG) for auditing.
 */
export async function evaluateVpn(ip: string): Promise<VpnEvaluation> {
  const { policy } = await loadVpnConfig();
  const flagged = await detectVpn(ip);
  // Skip the exception lookup entirely when there is no evidence.
  const excepted = flagged ? await isExcepted(ip) : false;
  const blocked = isBlockPolicy(policy) && flagged && !excepted;
  return { flagged, excepted, blocked, policy };
}
