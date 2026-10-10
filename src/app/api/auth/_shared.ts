// Knight FM — auth API shared internals (Task 2-a).
// Private module: NOT a route (no route.ts). Imported only by /api/auth/** handlers.

import { randomBytes, randomInt } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/api";
import { sendEmail, sha256 } from "@/lib/auth";
import { getInt } from "@/lib/config";
import { applyUserFundsLevy, creditFund, creditPersonal } from "@/lib/engine/finance";

// ─── Body validation (Zod v4) ─────────────────────────────────────

export const EMAIL_MAX = 254;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;

export const EmailSchema = z.email({ message: "auth.err.emailInvalid" }).trim().toLowerCase().max(EMAIL_MAX);
export const UsernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, "auth.err.usernameShort")
  .max(USERNAME_MAX, "auth.err.usernameShort")
  .regex(/^[A-Za-z0-9_-]+$/, "auth.err.usernameChars");
export const PasswordSchema = z.string().min(1).max(200);
export const CodeSchema = z.string().trim().regex(/^\d{6}$/, "auth.err.tokenInvalid");
export const TokenSchema = z.string().trim().min(16).max(128);
export const CaptchaSchema = z.string().min(1).max(4096);

// Re-export zod for sibling route files.
export { z };

// ─── Anti-enumeration user lookup (case-insensitive email) ────────

/**
 * Finds a user by email, case-insensitively. SQLite `contains` maps to LIKE
 * (ASCII case-insensitive) so candidates are filtered again in JS for exactness.
 */
export async function findUserByEmail(email: string) {
  const lc = email.toLowerCase();
  const exact = await db.user.findUnique({ where: { email: lc } });
  if (exact) return exact;
  const candidates = await db.user.findMany({
    where: { email: { contains: email } },
    select: { id: true },
  });
  if (candidates.length === 0) return null;
  const full = await db.user.findMany({
    where: { id: { in: candidates.map((c) => c.id) } },
  });
  return full.find((u) => u.email.toLowerCase() === lc) ?? null;
}

// ─── Verification / reset token issuance ──────────────────────────

export const VERIFY_TOKEN_TTL_MS = 30 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * SECURITY (pentest fix): dev tokens are NEVER exposed through the API in
 * production — a response-borne token lets anyone take over any account just
 * by knowing the email (verified live during the audit). They are returned
 * only in non-production builds so the on-premise flow stays completable.
 */
function exposeDevTokens(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Creates a 6-digit EMAIL_VERIFY token (sha256-hashed at rest) and emails the code.
 * Sandbox honesty (D-005 extended): when no real email provider is configured
 * (console transport) there is no mailbox to deliver to, so `devCode` is returned
 * to the caller so the flow stays completable on-premise — NON-PRODUCTION ONLY.
 * With a real provider (resend/smtp) the code is NEVER exposed through the API.
 */
export async function issueEmailVerification(email: string): Promise<{ devCode?: string }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.verificationToken.create({
    data: {
      email: email.toLowerCase(),
      codeHash: sha256(code),
      purpose: "EMAIL_VERIFY",
      expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });
  const delivery = await sendEmail(
    email,
    "Knight FM — Código de verificación",
    `Tu código de verificación Knight FM es: ${code} (válido 30 minutos). Si no solicitaste esta cuenta, ignora este mensaje.`,
    { highlight: code }
  );
  return delivery.provider === "console" && exposeDevTokens() ? { devCode: code } : {};
}

/**
 * Creates a 48-hex PASSWORD_RESET token (sha256-hashed at rest) and emails the plaintext token.
 * Console-mode honesty: `devToken` is returned only when no real email provider is
 * configured; with resend/smtp the token is delivered exclusively by email.
 */
export async function issuePasswordReset(email: string): Promise<{ devToken?: string }> {
  // SECURITY (pentest fix): in production without a real email provider the
  // reset token would be undeliverable AND must never leak through the API
  // (live-exploited account takeover). Fail closed instead of issuing.
  const token = randomBytes(24).toString("hex");
  await db.verificationToken.create({
    data: {
      email: email.toLowerCase(),
      codeHash: sha256(token),
      purpose: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });
  const delivery = await sendEmail(
    email,
    "Knight FM — Recuperación de contraseña",
    `Tu token de recuperación Knight FM es: ${token} (válido 30 minutos). Úsalo en "Recuperar contraseña" para definir una nueva. Si no lo solicitaste, ignora este mensaje.`,
    { highlight: token }
  );
  return delivery.provider === "console" && exposeDevTokens() ? { devToken: token } : {};
}

// ─── Referral bonus (idempotent, deterministic keys) ──────────────

/**
 * Grants the referral bonus to the referee (and referrer) exactly once per
 * completed referral. Deterministic idempotency keys derived from the referee id:
 *   REFERRAL_BONUS:<refereeId>            — referee credit
 *   REFERRAL_BONUS:<refereeId>:REFERRER   — referrer credit for this referral event
 */
export async function grantReferralBonuses(refereeId: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { id: refereeId },
    select: { id: true, referredById: true, referralCredited: true },
  });
  if (!user?.referredById || user.referralCredited) return false;

  const bonus = await getInt("referral.bonus", 100);
  if (bonus <= 0) {
    await db.user.update({ where: { id: user.id }, data: { referralCredited: true } });
    return false;
  }

  const referrerId = user.referredById;
  await db.$transaction(async (tx) => {
    // Referral credits are platform income: the configurable income levy applies
    // (same treatment as the scheduler's settleReferrals — gross/levy/net).
    const a = await applyUserFundsLevy(bonus);
    await creditPersonal(tx, user.id, a.net, "REFERRAL", `REFERRAL_BONUS:${user.id}`, "Bono de referido recibido (neto tras gravamen)", { gross: a.gross, levy: a.levy, net: a.net });
    await creditPersonal(
      tx,
      referrerId,
      a.net,
      "REFERRAL",
      `REFERRAL_BONUS:${user.id}:REFERRER`,
      `Bono por referir a ${user.id} (neto tras gravamen)`,
      { gross: a.gross, levy: a.levy, net: a.net }
    );
    if (a.levy > 0) {
      await creditFund(tx, "SYSTEM", a.levy, `REFERRAL_BONUS:${user.id}:LEVY`, "INCOME_LEVY", "Income levy on referral bonus");
    }
    await tx.user.update({ where: { id: user.id }, data: { referralCredited: true } });
  });
  await audit("REFERRAL_GRANTED", referrerId, { refereeId: user.id, bonus });
  return true;
}

// ─── Error carrier for transactional handlers ─────────────────────

/** Thrown inside db.$transaction to abort; converted to a typed API failure outside. */
export class ApiTxError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message = "") {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}
