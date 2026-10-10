// Knight FM — Perimeter middleware (edge runtime, AUTOCONTENIDO).
// Adds SECURITY HEADERS to every passing response and enforces per-IP rate
// limits (global + auth buckets). Reads ONLY headers — never request bodies —
// so SSE/presence and POSTs with bodies are unaffected. Contains NO auth logic
// and NO imports from src/lib/* or Prisma (must stay self-contained on edge).

import { NextRequest, NextResponse } from "next/server";

// ─── Tunables (env-overridable, parsed defensively) ───────────────

function envInt(name: string, fallback: number): number {
  try {
    const raw = process.env[name];
    if (typeof raw !== "string" || raw.trim() === "") return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

const RATE_LIMIT_GLOBAL_MAX = envInt("RATE_LIMIT_GLOBAL_MAX", 300); // req / 60s per IP
const RATE_LIMIT_AUTH_MAX = envInt("RATE_LIMIT_AUTH_MAX", 60); // req / 300s per IP on /api/auth/*
const GLOBAL_WINDOW_MS = 60_000;
const AUTH_WINDOW_MS = 300_000;
const KEY_CAP = 10_000; // hard cap on tracked keys (resists XFF-spoof floods)

// SECURITY (pentest hardening): 'unsafe-eval' is required by the Next.js dev
// overlay/React-refresh but must never ship to production — eval-capable CSP
// turns any future injection sink into full account compromise. 'unsafe-inline'
// stays (Next injects inline bootstrap scripts; nonce-based CSP is a larger
// migration) — documented residual risk.
// CAPTCHA (D-004): challenges.cloudflare.com is whitelisted for script/frame/
// connect because Cloudflare Turnstile loads its widget as a remote script
// inside a cross-origin iframe. Allowed unconditionally — nothing loads from
// that host unless the app itself requests the Turnstile API.
const isDev = process.env.NODE_ENV !== "production";
const TURNSTILE_CSP = "https://challenges.cloudflare.com";
const CSP = `default-src 'self'; script-src 'self' 'unsafe-inline' ${TURNSTILE_CSP}${isDev ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: wss: ${TURNSTILE_CSP}; frame-src ${TURNSTILE_CSP}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;

const PERMISSIONS_POLICY =
  "camera=(), microphone=(), geolocation=(), payment=(), usb=()";

// ─── Rate-limit store: local Map, lazy cleanup + periodic sweep + hard cap ──

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;
const MAX_WINDOW_MS = Math.max(GLOBAL_WINDOW_MS, AUTH_WINDOW_MS);

/** Passive sweep: drop buckets whose last hit is older than the longest window. */
function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  try {
    for (const [key, bucket] of store) {
      const last = bucket.hits.length > 0 ? bucket.hits[bucket.hits.length - 1] : NaN;
      if (!Number.isFinite(last) || now - last >= MAX_WINDOW_MS) store.delete(key);
    }
  } catch {
    /* never throw from housekeeping */
  }
}

/** Evict the oldest key (Map preserves insertion order) when over capacity. */
function evictOldest(): void {
  const oldest = store.keys().next();
  if (!oldest.done) store.delete(oldest.value);
}

/** Sliding-window counter. Returns allow/deny + retry-after + remaining quota. */
function hit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
    if (store.size > KEY_CAP) evictOldest();
  }
  // Lazy per-bucket cleanup: drop expired timestamps.
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((windowMs - (now - bucket.hits[0])) / 1000),
    );
    return { allowed: false, retryAfterSec, remaining: 0 };
  }
  bucket.hits.push(now);
  return { allowed: true, retryAfterSec: 0, remaining: Math.max(0, limit - bucket.hits.length) };
}

// ─── Client IP (first XFF hop; resilient to malformed/absent headers) ───────

function ipKey(req: NextRequest): string {
  try {
    const xff = req.headers.get("x-forwarded-for");
    if (typeof xff === "string" && xff.length > 0) {
      const first = xff.split(",")[0]?.trim().slice(0, 64);
      if (first) return first;
    }
  } catch {
    /* fall through */
  }
  return "local";
}

// ─── Security headers (applied to next() AND 429 responses) ─────────────────

function applySecurityHeaders(res: NextResponse, req: NextRequest): void {
  const h = res.headers;
  h.set("Content-Security-Policy", CSP);
  h.set("X-Frame-Options", "DENY");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", PERMISSIONS_POLICY);
  h.set("X-DNS-Prefetch-Control", "off");
  h.set("Cross-Origin-Opener-Policy", "same-origin");

  // HSTS only when the request actually arrived over TLS (behind a proxy).
  try {
    if (req.headers.get("x-forwarded-proto") === "https") {
      h.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
  } catch {
    /* ignore */
  }

  // Keep API surface out of search indexes.
  try {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      h.set("X-Robots-Tag", "noindex, nofollow");
    }
  } catch {
    /* ignore */
  }
}

function rateLimitHeaders(
  res: NextResponse,
  pathname: string,
  limit: number,
  remaining: number,
): void {
  if (!pathname.startsWith("/api/")) return;
  res.headers.set("X-RateLimit-Limit", String(limit));
  res.headers.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));
}

// ─── Middleware entry ────────────────────────────────────────────────────────

export function middleware(req: NextRequest): NextResponse {
  try {
    const now = Date.now();
    sweep(now);

    const pathname = req.nextUrl.pathname;
    const ip = ipKey(req);
    const isAuthPath = pathname.startsWith("/api/auth");

    // Global bucket counts every passing request; auth paths also consume the
    // stricter auth bucket.
    const globalVerdict = hit(`g:${ip}`, RATE_LIMIT_GLOBAL_MAX, GLOBAL_WINDOW_MS, now);
    const authVerdict = isAuthPath
      ? hit(`a:${ip}`, RATE_LIMIT_AUTH_MAX, AUTH_WINDOW_MS, now)
      : null;

    const blocked =
      !globalVerdict.allowed || (authVerdict !== null && !authVerdict.allowed);

    if (blocked) {
      const isGlobalBlock = !globalVerdict.allowed;
      const retryAfterSec = isGlobalBlock
        ? globalVerdict.retryAfterSec
        : (authVerdict?.retryAfterSec ?? 1);
      const limit = isGlobalBlock ? RATE_LIMIT_GLOBAL_MAX : RATE_LIMIT_AUTH_MAX;

      const res = NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429 },
      );
      applySecurityHeaders(res, req);
      res.headers.set("Retry-After", String(retryAfterSec));
      rateLimitHeaders(res, pathname, limit, 0);
      return res;
    }

    const res = NextResponse.next();
    applySecurityHeaders(res, req);
    // X-RateLimit-Limit/Remaining reflect the bucket that governs this path.
    if (isAuthPath && authVerdict !== null) {
      rateLimitHeaders(res, pathname, RATE_LIMIT_AUTH_MAX, authVerdict.remaining);
    } else {
      rateLimitHeaders(res, pathname, RATE_LIMIT_GLOBAL_MAX, globalVerdict.remaining);
    }
    return res;
  } catch {
    // Malformed input / unexpected edge case must NEVER take the app down.
    return NextResponse.next();
  }
}

export const config = {
  // Run on everything EXCEPT static assets (og-knight-fm.png lands with 24-b).
  matcher:
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|knight-logo.png|og-knight-fm.png).*)',
};
