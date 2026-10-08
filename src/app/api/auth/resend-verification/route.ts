// Knight FM — POST /api/auth/resend-verification (spec AUTH-03).
// Rate limited 3/hour per email+IP. The response is generic regardless of
// whether the email exists or is already verified (anti-enumeration, D-005).

import { NextRequest } from "next/server";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { verifyCaptcha } from "@/lib/auth";
import { db } from "@/lib/db";
import { CaptchaSchema, EmailSchema, findUserByEmail, issueEmailVerification, z } from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({
  email: EmailSchema,
  // Optional so a missing token reaches verifyCaptcha and yields 402 CAPTCHA_INVALID.
  captchaToken: CaptchaSchema.optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);
  const { email, captchaToken } = parsed.data;
  const emailLc = email.toLowerCase();

  const rl = rateLimit(`resend:${emailLc}|${ip}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    await audit("AUTH_RESEND_RATE_LIMITED", null, { email: emailLc, ip });
    return fail("RATE_LIMITED", "Too many requests", 429, { retryAfterSec: rl.retryAfterSec });
  }

  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) {
    return fail("CAPTCHA_INVALID", "Captcha verification failed", 402);
  }

  const user = await findUserByEmail(emailLc);
  let devCode: string | undefined;
  if (user && !user.emailVerified) {
    const issued = await issueEmailVerification(user.email);
    // Console transport only: code surfaced on-premise; with a real provider it stays email-only.
    devCode = issued.devCode;
    await audit("AUTH_RESEND_VERIFICATION", user.id, { email: user.email, ip });
  } else {
    // Unknown email or already verified: audit silently, respond identically.
    await audit("AUTH_RESEND_VERIFICATION_SKIPPED", null, { ip });
  }

  return ok({ sent: true, ...(devCode ? { devCode } : {}) });
}
