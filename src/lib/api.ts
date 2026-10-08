// Knight FM — API helpers: typed JSON responses, auth extraction, rate limiting, audit.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/auth";
import { getBool, getConfig } from "@/lib/config";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: string, message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });
}

export interface AuthCtx {
  userId: string;
  role: string;
}

export async function getAuth(req: NextRequest): Promise<AuthCtx | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const payload = await verifyAccessToken(header.slice(7));
  if (!payload) return null;
  return { userId: payload.userId, role: payload.role };
}

export async function requireAuth(req: NextRequest): Promise<AuthCtx | NextResponse> {
  const auth = await getAuth(req);
  if (!auth) return fail("UNAUTHORIZED", "Authentication required", 401);
  // Task 41 (anti-multicuenta): a BLOCKED account (multi-account IP auto-block
  // or admin manual block) is locked out of EVERY route immediately. Blocking
  // revokes all refresh sessions, but short-lived access tokens would keep
  // working until expiry — this PK lookup closes that window. A token for a
  // hard-deleted user is also rejected here.
  const me = await db.user.findUnique({ where: { id: auth.userId }, select: { status: true } });
  if (!me) return fail("UNAUTHORIZED", "Authentication required", 401);
  if (me.status === "BLOCKED") {
    return fail("ACCOUNT_BLOCKED", "Account blocked — only an administrator can unblock it", 403);
  }
  // Maintenance gate (Task 27-b): while maintenance mode is active only ADMIN
  // requests reach the API. Blocked requests return BEFORE touchLastActive —
  // they are not real "access", so the inactivity engine must not count them.
  if (auth.role !== "ADMIN" && (await getBool("ops.maintenanceMode"))) {
    return fail("MAINTENANCE", await getConfig("ops.maintenanceMessage"), 503);
  }
  touchLastActive(auth.userId);
  return auth;
}

// ─── Last-activity heartbeat (Task 25-a) ──────────────────────────

/** A user is considered "active" if their lastActiveAt refreshed within 6h. */
const LAST_ACTIVE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Fire-and-forget refresh of User.lastActiveAt after a valid token check.
 * Runs at most once every 6h per user; it NEVER blocks or fails the request
 * (errors swallowed). Applies to every role including ADMIN (harmless), so the
 * inactivity engine (src/lib/engine/inactivity.ts) sees real access patterns.
 */
function touchLastActive(userId: string): void {
  void db.user
    .findUnique({ where: { id: userId }, select: { lastActiveAt: true } })
    .then((user) => {
      if (!user) return;
      if (Date.now() - user.lastActiveAt.getTime() > LAST_ACTIVE_TTL_MS) {
        return db.user.update({ where: { id: userId }, data: { lastActiveAt: new Date() } });
      }
      return undefined;
    })
    .catch(() => undefined);
}

export function isResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}

export async function audit(type: string, actorId: string | null, payload: Record<string, unknown> = {}) {
  // Task 39 (live-test finding): audit writes are OBSERVABILITY, not business
  // correctness — under a SQLite write pileup a timed-out audit must never
  // turn a correctly-handled response into a 500. Swallow + log; the event is
  // lost but the endpoint's real outcome is preserved.
  try {
    await db.auditEvent.create({ data: { type, actorId, payload: JSON.stringify(payload) } });
  } catch (err) {
    console.error("[audit] write failed", type, err instanceof Error ? err.message : err);
  }
}

// ─── In-memory sliding-window rate limiter (single instance) ──────

// SECURITY (pentest fix — memory DoS): attacker-controlled keys (email|ip,
// rotable via X-Forwarded-For) previously grew this Map without bound. Keys are
// now capped and expired entries are swept periodically.
const buckets = new Map<string, number[]>();
const RATE_KEY_CAP = 10_000;
let lastSweepAt = 0;
const RATE_WINDOW_MAX_MS = 60 * 60 * 1000;

function sweepBuckets(): void {
  const now = Date.now();
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [k, arr] of buckets) {
    const alive = arr.filter((t) => now - t < RATE_WINDOW_MAX_MS);
    if (alive.length === 0) buckets.delete(k);
    else buckets.set(k, alive);
  }
  while (buckets.size > RATE_KEY_CAP) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  sweepBuckets();
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - arr[0])) / 1000) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { allowed: true, retryAfterSec: 0 };
}

export function clientIp(req: NextRequest): string {
  // SECURITY (pentest fix — XFF spoofing): Caddy (the trusted perimeter) uses
  // header_up X-Forwarded-For {remote_host}, which REPLACES the header with the
  // real client IP — so a request through the proxy carries EXACTLY one entry.
  // A direct-to-origin request can set arbitrary XFF values; honoring the first
  // entry there let attackers rotate identities to bypass rate limits, login
  // lockout and VPN policy (live-exploited). Take the LAST entry: through the
  // trusted proxy it equals the real client; a spoofed multi-hop chain is
  // attributed to its final (spoofed-but-consistent) hop and, critically, the
  // email-only lockout layer now also caps damage when IPs are rotated.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export async function readJson<T>(req: NextRequest): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
