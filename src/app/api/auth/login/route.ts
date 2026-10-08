// Knight FM — POST /api/auth/login (spec AUTH-05, AUTH-09).
// Captcha-protected, per email|ip lockout after repeated failures, generic
// invalid-credentials errors. EMAIL_NOT_VERIFIED is only disclosed after the
// password has been validated (it is not an enumeration vector).

import { NextRequest } from "next/server";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { verifyCaptcha, verifyPassword, checkLockout, checkLockoutEmail, recordFailedLogin, clearLockout, clearLockoutEmail, fakePasswordVerify, signAccessToken, createSession } from "@/lib/auth";
import { enforceMultiAccountIp } from "@/lib/security/ip-guard";
import { evaluateVpn } from "@/lib/vpn";
import { getBool, getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { CaptchaSchema, EmailSchema, PasswordSchema, findUserByEmail, z } from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  // Optional here so a missing token reaches verifyCaptcha and yields 402 CAPTCHA_INVALID.
  captchaToken: CaptchaSchema.optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  // Coarse per-IP throttle beneath the lockout layer.
  const rl = rateLimit(`login:${ip}`, 60, 15 * 60 * 1000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429, { retryAfterSec: rl.retryAfterSec });
  }

  // VPN policy guard (Task 25-d): evaluated AFTER the rate limit (so the limit
  // keeps protecting the endpoint) and BEFORE any other logic. LOGIN grants a
  // documented ADMIN bypass: enforcement of the block decision is deferred to
  // right after verifyPassword (the role is only known there) — an ADMIN signing
  // in from a flagged, non-excepted IP is allowed through (escape hatch so
  // admins can reach the Control Center and manage the VpnException list
  // themselves). Everyone else gets 403 VPN_BLOCKED before any session/lockout
  // mutation. Detector evidence is still logged for ADMINs (VPN_LOG, adminBypass).
  const vpn = await evaluateVpn(ip);
  if (vpn.flagged && !vpn.blocked) {
    // log_only mode or excepted IP: fire-and-forget audit, never blocks.
    void audit("VPN_LOG", null, { ip, route: "login", excepted: vpn.excepted }).catch(() => {});
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);
  const { email, password, captchaToken } = parsed.data;
  const emailLc = email.toLowerCase();

  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) {
    await audit("AUTH_LOGIN_CAPTCHA_FAILED", null, { ip });
    return fail("CAPTCHA_INVALID", "Captcha verification failed", 402);
  }

  const lockKey = `${emailLc}|${ip}`;
  // SECURITY (pentest fix): dual lockout — per email|ip AND per email only.
  // The email-only layer defeats X-Forwarded-For rotation (live-exploited).
  const [lock, lockEmail] = await Promise.all([checkLockout(lockKey), checkLockoutEmail(emailLc)]);
  const activeLock = lock.locked ? lock : lockEmail;
  if (activeLock.locked) {
    await audit("AUTH_LOGIN_LOCKED", null, { email: emailLc, ip });
    return fail("LOCKED", "Too many failed attempts", 429, { retryAfterSec: activeLock.retryAfterSec });
  }

  const user = await findUserByEmail(emailLc);
  // SECURITY (pentest fix — timing enumeration): equalize response time when
  // the email does not exist by running a real (always-failing) Argon2 verify.
  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : ((await fakePasswordVerify()), false);
  if (!user || !passwordOk) {
    await recordFailedLogin(lockKey, emailLc);
    await audit("AUTH_LOGIN_FAILED", user?.id ?? null, { email: emailLc, ip, reason: user ? "BAD_PASSWORD" : "UNKNOWN_EMAIL" });
    return fail("INVALID_CREDENTIALS", "Invalid credentials", 401);
  }

  // Enforce the VPN block now that the role is known (ADMIN bypass above).
  if (vpn.blocked && user.role !== "ADMIN") {
    await audit("VPN_BLOCK", null, { ip, route: "login" });
    return fail("VPN_BLOCKED", "Access denied: VPN/proxy detected", 403);
  }
  if (vpn.blocked && user.role === "ADMIN") {
    void audit("VPN_LOG", null, { ip, route: "login", excepted: vpn.excepted, adminBypass: true }).catch(() => {});
  }

  // Maintenance gate (Task 27-b): while maintenance mode is active only ADMINs
  // may sign in (they need the Control Center to turn it off). Placed AFTER
  // password verification so no account state is ever disclosed pre-auth.
  if (user.role !== "ADMIN" && (await getBool("ops.maintenanceMode"))) {
    void audit("AUTH_LOGIN_BLOCKED", user.id, { reason: "MAINTENANCE", ip }).catch(() => {});
    return fail("MAINTENANCE", await getConfig("ops.maintenanceMessage"), 503);
  }

  if (!user.emailVerified) {
    await audit("AUTH_LOGIN_UNVERIFIED", user.id, { email: emailLc, ip });
    return fail("EMAIL_NOT_VERIFIED", "Verify your email before signing in", 403);
  }

  // Task 41 (anti-multicuenta, USER MANDATE): a BLOCKED account never gets a
  // session again. The machine reason travels in `extra` so the client can map
  // it to an honest i18n message (multi-account IP auto-block vs admin block).
  if (user.status === "BLOCKED") {
    await audit("AUTH_LOGIN_BLOCKED_ACCOUNT", user.id, { ip, reason: user.blockedReason });
    return fail("ACCOUNT_BLOCKED", "Account blocked — only an administrator can unblock it", 403, {
      reason: user.blockedReason,
    });
  }

  clearLockout(lockKey);
  clearLockoutEmail(emailLc);

  // Task 41 (USER MANDATE — 30-day multi-account rule): record this account's
  // IP evidence and, when ANOTHER ACTIVE account has used the SAME IP within
  // the configured window (security.ipWindowDays, default 30), auto-block every
  // involved account and refuse this sign-in. Runs BEFORE any session exists,
  // so a blocked user never holds a token. It also stamps lastLoginIp + the
  // IpLink evidence row synchronously (replaces the old fire-and-forget update).
  const ipGuard = await enforceMultiAccountIp({ userId: user.id, ip, role: user.role });
  if (ipGuard.blocked) {
    await audit("AUTH_LOGIN_MULTIACCOUNT_IP", user.id, { ip, accounts: ipGuard.accounts });
    return fail(
      "MULTI_ACCOUNT_IP_BLOCKED",
      "Multiple accounts detected on this IP; the accounts have been blocked",
      403
    );
  }

  const accessToken = await signAccessToken(user.id, user.role);
  const { refreshToken } = await createSession(user.id, ip, req.headers.get("user-agent") ?? undefined);

  const [wallet, ownedClubs, managedClub] = await Promise.all([
    db.personalWallet.findUnique({ where: { userId: user.id }, select: { balance: true } }),
    db.club.findMany({ where: { ownerId: user.id }, select: { id: true } }),
    db.club.findFirst({ where: { managerId: user.id }, select: { id: true } }),
  ]);

  await audit("AUTH_LOGIN", user.id, { email: emailLc, ip });

  return ok({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      path: user.path,
      locale: user.locale,
      theme: user.theme,
      emailVerified: user.emailVerified,
      walletBalance: wallet?.balance ?? 0,
      ownedClubIds: ownedClubs.map((c) => c.id),
      managedClubId: managedClub?.id ?? null,
    },
  });
}
