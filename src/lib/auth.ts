// Knight FM — authentication core (spec §45, D-003/D-004/D-005/D-006).
// Argon2id hashing, JWT access tokens (15 min) + rotating refresh tokens (7 d),
// server-side Turnstile validation, generic anti-enumeration errors, audit events.

import { SignJWT, jwtVerify } from "jose";
import { hash, verify } from "@node-rs/argon2";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getBool, getConfig, getInt } from "@/lib/config";

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

// SECURITY (pentest fix): the signing secret MUST come from the environment.
// The old constant fallback meant anyone with repo access could forge ADMIN
// JWTs (verified live: full Control Center takeover + money minting).
let cachedKey: Uint8Array | null = null;
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET env var is required (>= 16 chars) — refusing to sign with a weak/missing secret");
    }
    // Dev-only fallback: random per-boot key. Access tokens invalidate on restart;
    // users keep their DB-backed refresh sessions and rotate seamlessly.
    cachedKey = new TextEncoder().encode(randomBytes(32).toString("hex"));
    return cachedKey;
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function hashPassword(pw: string): Promise<string> {
  return hash(pw, ARGON2_OPTS);
}

export async function verifyPassword(hashVal: string, pw: string): Promise<boolean> {
  try {
    return await verify(hashVal, pw, ARGON2_OPTS);
  } catch {
    return false;
  }
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function passwordPolicyError(pw: string): string | null {
  if (pw.length < 12) return "auth.err.passwordShort";
  if (!/[A-Z]/.test(pw)) return "auth.err.passwordUpper";
  if (!/[a-z]/.test(pw)) return "auth.err.passwordLower";
  if (!/[0-9]/.test(pw)) return "auth.err.passwordDigit";
  if (!/[^A-Za-z0-9]/.test(pw)) return "auth.err.passwordSymbol";
  return null;
}

export async function signAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<{ userId: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return { userId: String(payload.sub), role: String(payload.role ?? "USER") };
  } catch {
    return null;
  }
}

export function newRefreshToken(): string {
  return randomBytes(48).toString("hex");
}

export async function createSession(userId: string, ip?: string, userAgent?: string): Promise<{ refreshToken: string; sessionId: string }> {
  const refreshToken = newRefreshToken();
  const session = await db.session.create({
    data: {
      userId,
      refreshTokenHash: sha256(refreshToken),
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });
  return { refreshToken, sessionId: session.id };
}

/** Rotate a refresh token: revoke old, issue new. Returns null if invalid/revoked/expired. */
export async function rotateRefreshToken(refreshToken: string, ip?: string): Promise<{ userId: string; refreshToken: string } | null> {
  const oldHash = sha256(refreshToken);
  const session = await db.session.findUnique({ where: { refreshTokenHash: oldHash } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    // SECURITY (pentest fix): reuse detection. Presenting a token that was
    // already rotated (or revoked) is the classic signal of a stolen session:
    // revoke every session of that user instead of failing silently.
    if (session && session.userId) {
      await revokeAllSessions(session.userId);
      await db.auditEvent.create({ data: { type: "AUTH_REFRESH_REUSE_DETECTED", actorId: session.userId, payload: JSON.stringify({ ip }) } });
    }
    return null;
  }
  const next = newRefreshToken();
  // SECURITY (pentest fix): atomic conditional rotation. The previous
  // find->update race let two concurrent refreshes both succeed (dual live
  // sessions). Only the FIRST caller that flips the hash wins.
  const claimed = await db.session.updateMany({
    where: { id: session.id, refreshTokenHash: oldHash, revokedAt: null },
    data: { refreshTokenHash: sha256(next), expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
  });
  if (claimed.count === 0) {
    await revokeAllSessions(session.userId);
    await db.auditEvent.create({ data: { type: "AUTH_REFRESH_REUSE_DETECTED", actorId: session.userId, payload: JSON.stringify({ ip }) } });
    return null;
  }
  await db.auditEvent.create({ data: { type: "AUTH_REFRESH_ROTATED", actorId: session.userId, payload: JSON.stringify({ ip }) } });
  return { userId: session.userId, refreshToken: next };
}

export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  const session = await db.session.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
  if (!session) return false;
  await db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return true;
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ─── CAPTCHA (D-004) ──────────────────────────────────────────────

export interface CaptchaResult { ok: boolean; provider: string; reason?: string }

export async function verifyCaptcha(token: string | undefined, ip?: string): Promise<CaptchaResult> {
  const provider = await getConfig("security.captchaProvider");
  // SECURITY (pentest fix): the environment must win over the config default.
  // The old precedence made the config default "sandbox" shadow a properly
  // configured TURNSTILE_SECRET_KEY, silently disabling bot protection.
  const effective =
    process.env.TURNSTILE_SECRET_KEY && (provider === "sandbox" || !provider)
      ? "cloudflare_turnstile"
      : provider || (process.env.TURNSTILE_SECRET_KEY ? "cloudflare_turnstile" : "sandbox");
  if (!token) return { ok: false, provider: effective, reason: "MISSING_TOKEN" };
  if (effective === "cloudflare_turnstile") {
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY as string, response: token, remoteip: ip ?? "" }),
      });
      const data = (await res.json()) as { success: boolean; "error-codes"?: string[] };
      return { ok: !!data.success, provider: effective, reason: data.success ? undefined : (data["error-codes"]?.join(",") ?? "FAILED") };
    } catch (e) {
      return { ok: false, provider: effective, reason: "PROVIDER_UNREACHABLE" };
    }
  }
  // Sandbox provider: token presence required; external validation capability not configured (documented D-004).
  await db.auditEvent.create({ data: { type: "CAPTCHA_SANDBOX_PASS", payload: JSON.stringify({ ip }) } });
  return { ok: true, provider: effective };
}

// ─── Email delivery (D-005, extended) ─────────────────────────────
//
// Providers (selected via EMAIL_PROVIDER env var):
//   resend  — Resend HTTP API (needs RESEND_API_KEY, optional EMAIL_FROM). No SMTP required.
//   smtp    — Any SMTP server via nodemailer (SMTP_HOST/PORT/USER/PASS/SECURE, EMAIL_FROM).
//   console — Default sandbox transport: message is logged to the server console only.
//
// Delivery result honesty: `delivered` is true ONLY when a real provider accepted
// the message. Callers use it to decide whether the code may be surfaced to the
// client (see issueEmailVerification): with a real provider the code is NEVER
// exposed through the API; in console mode there is no mailbox to deliver to, so
// the code is returned to the client to keep the flow completable on-premise.

export interface EmailDeliveryResult {
  /** true only when a real provider accepted the message. */
  delivered: boolean;
  /** Effective transport used: "resend" | "smtp" | "console". */
  provider: string;
  /** Provider error detail when a real provider was configured but failed. */
  error?: string;
}

const EMAIL_FROM_DEFAULT = "Knight FM <onboarding@resend.dev>";

function emailHtmlBody(subject: string, body: string): string {
  return [
    '<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">',
    '<div style="font-size:13px;letter-spacing:0.18em;font-weight:700;color:#10b981">KNIGHT FM</div>',
    `<h2 style="font-size:20px;margin:12px 0">${subject}</h2>`,
    `<p style="font-size:15px;line-height:1.6;color:#374151">${body}</p>`,
    '<p style="font-size:12px;color:#9ca3af;margin-top:24px">Si no solicitaste este mensaje, ignóralo.</p>',
    "</div>",
  ].join("");
}

/** Console fallback so a code is never lost when a real provider fails. */
function consoleFallback(to: string, subject: string, body: string): void {
  console.log(`[EMAIL:fallback:console] to=${to} subject="${subject}" body=${body}`);
}

export function emailProviderConfigured(): boolean {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
  if (provider === "resend") return Boolean(process.env.RESEND_API_KEY);
  if (provider === "smtp") return Boolean(process.env.SMTP_HOST);
  return false;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<EmailDeliveryResult> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();

  try {
    if (provider === "resend" && process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || EMAIL_FROM_DEFAULT,
          to: [to],
          subject,
          text: body,
          html: emailHtmlBody(subject, body),
        }),
      });
      if (res.ok) {
        await db.auditEvent.create({ data: { type: "EMAIL_SENT", payload: JSON.stringify({ to, subject, provider }) } });
        return { delivered: true, provider };
      }
      const detail = (await res.text()).slice(0, 300);
      console.error(`[EMAIL:resend] delivery failed (${res.status}): ${detail}`);
      consoleFallback(to, subject, body);
      await db.auditEvent.create({
        data: { type: "EMAIL_DELIVERY_FAILED", payload: JSON.stringify({ to, subject, provider, status: res.status }) },
      });
      return { delivered: false, provider, error: `RESEND_HTTP_${res.status}` };
    }

    if (provider === "smtp" && process.env.SMTP_HOST) {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
      });
      await transport.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || EMAIL_FROM_DEFAULT,
        to,
        subject,
        text: body,
        html: emailHtmlBody(subject, body),
      });
      await db.auditEvent.create({ data: { type: "EMAIL_SENT", payload: JSON.stringify({ to, subject, provider }) } });
      return { delivered: true, provider };
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error(`[EMAIL:${provider}] delivery failed: ${detail}`);
    consoleFallback(to, subject, body);
    await db.auditEvent.create({
      data: { type: "EMAIL_DELIVERY_FAILED", payload: JSON.stringify({ to, subject, provider, error: detail.slice(0, 300) }) },
    });
    return { delivered: false, provider, error: detail.slice(0, 200) };
  }

  // Console transport (sandbox default): visible in server logs + audit trail only.
  console.log(`[EMAIL:console] to=${to} subject="${subject}" body=${body}`);
  await db.auditEvent.create({ data: { type: "EMAIL_SENT", payload: JSON.stringify({ to, subject, provider: "console" }) } });
  return { delivered: false, provider: "console" };
}

// ─── Login lockout (spec AUTH-09) ─────────────────────────────────

const attempts = new Map<string, { count: number; until: number }>();

// SECURITY (pentest fix — memory DoS): attacker-controlled keys (email|ip) used
// to grow this map without bound. Cap total tracked keys and sweep expired ones.
const ATTEMPTS_KEY_CAP = 10_000;
let attemptsSweptAt = 0;
function sweepAttempts(): void {
  const now = Date.now();
  if (now - attemptsSweptAt < 60_000) return;
  attemptsSweptAt = now;
  for (const [k, v] of attempts) if (v.until <= now) attempts.delete(k);
  while (attempts.size > ATTEMPTS_KEY_CAP) {
    const oldest = attempts.keys().next().value;
    if (oldest === undefined) break;
    attempts.delete(oldest);
  }
}

// SECURITY (pentest fix — brute force): the lockout was keyed `email|ip`, so
// rotating X-Forwarded-For reset the counter on every attempt (live-exploited).
// A SECONDARY email-only threshold now locks the account itself no matter how
// many IPs the attacker rotates through.
function emailOnlyThreshold(max: number): number {
  return Math.max(3, max * 4);
}

// SECURITY (pentest fix): these were hardcoded while security.loginLockout*
// config keys existed but were dead. Values now come from the Control Center.
async function lockoutParams(): Promise<{ max: number; windowMs: number }> {
  const [max, minutes] = await Promise.all([
    getInt("security.loginLockoutAttempts", 5),
    getInt("security.loginLockoutMinutes", 15),
  ]);
  return { max: Math.max(1, max), windowMs: Math.max(1, minutes) * 60_000 };
}

export async function checkLockout(key: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  sweepAttempts();
  const rec = attempts.get(key);
  const { max } = await lockoutParams();
  // Lock only after the configured number of failed attempts (spec AUTH-09: 5).
  if (rec && rec.until > Date.now() && rec.count >= max) {
    return { locked: true, retryAfterSec: Math.ceil((rec.until - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Account-wide lockout check: independent of the attacker-controlled IP. */
export async function checkLockoutEmail(email: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  sweepAttempts();
  const rec = attempts.get(`emailonly:${email.toLowerCase()}`);
  const { max } = await lockoutParams();
  if (rec && rec.until > Date.now() && rec.count >= emailOnlyThreshold(max)) {
    return { locked: true, retryAfterSec: Math.ceil((rec.until - Date.now()) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

export async function recordFailedLogin(key: string, email?: string): Promise<void> {
  sweepAttempts();
  const rec = attempts.get(key);
  const { max, windowMs } = await lockoutParams();
  const now = Date.now();
  if (rec && rec.until > now) {
    rec.count += 1;
    if (rec.count >= max) rec.until = now + windowMs;
  } else {
    attempts.set(key, { count: 1, until: now + windowMs });
  }
  // Secondary per-account counter (IP-independent).
  if (email) {
    const ek = `emailonly:${email.toLowerCase()}`;
    const erec = attempts.get(ek);
    if (erec && erec.until > now) {
      erec.count += 1;
      if (erec.count >= emailOnlyThreshold(max)) erec.until = now + windowMs;
    } else {
      attempts.set(ek, { count: 1, until: now + windowMs });
    }
  }
}

export function clearLockout(key: string): void {
  attempts.delete(key);
}

/** Clears the account-wide counter on successful login. */
export function clearLockoutEmail(email: string): void {
  attempts.delete(`emailonly:${email.toLowerCase()}`);
}

// SECURITY (pentest fix — timing enumeration): Argon2id verification takes
// tens of ms; skipping it for unknown emails makes user enumeration trivial
// by timing. A real dummy verify equalizes the response time.
let dummyHashPromise: Promise<string> | null = null;
export async function fakePasswordVerify(): Promise<void> {
  try {
    if (!dummyHashPromise) dummyHashPromise = hash("dummy-password-" + randomBytes(8).toString("hex"), ARGON2_OPTS);
    await verify(await dummyHashPromise, "wrong-password-" + randomBytes(8).toString("hex"), ARGON2_OPTS);
  } catch {
    /* timing equalization only */
  }
}
