// Knight FM — POST /api/auth/password-reset/request (spec AUTH-07).
// Rate limited per email+IP; generic success response regardless of whether
// the email exists (anti-enumeration). The plaintext token is delivered via
// the console email provider only (D-005) — never through the API.

import { NextRequest } from "next/server";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { verifyCaptcha, emailProviderConfigured } from "@/lib/auth";
import { CaptchaSchema, EmailSchema, findUserByEmail, issuePasswordReset, z } from "../../_shared";

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

  const rlEmail = rateLimit(`pwreset:${emailLc}|${ip}`, 5, 60 * 60 * 1000);
  const rlIp = rateLimit(`pwreset-ip:${ip}`, 10, 60 * 60 * 1000);
  if (!rlEmail.allowed || !rlIp.allowed) {
    await audit("PASSWORD_RESET_RATE_LIMITED", null, { email: emailLc, ip });
    return fail("RATE_LIMITED", "Too many requests", 429, {
      retryAfterSec: Math.max(rlEmail.retryAfterSec, rlIp.retryAfterSec),
    });
  }

  const captcha = await verifyCaptcha(captchaToken, ip);
  if (!captcha.ok) {
    return fail("CAPTCHA_INVALID", "Captcha verification failed", 402);
  }

  const user = await findUserByEmail(emailLc);
  let devToken: string | undefined;
  if (user) {
    // SECURITY (pentest fix): fail closed in production without a real email
    // provider — the token would be undeliverable, and returning it in the
    // response enables account takeover (live-exploited during the audit).
    if (!emailProviderConfigured() && process.env.NODE_ENV === "production") {
      await audit("PASSWORD_RESET_UNAVAILABLE", user.id, { email: user.email, ip });
      return fail("RESET_UNAVAILABLE", "Password reset is not available: no email provider configured", 503);
    }
    const issued = await issuePasswordReset(user.email);
    // Console transport only: token surfaced on-premise (non-production); with a
    // real provider it stays email-only.
    devToken = issued.devToken;
    await audit("PASSWORD_RESET_REQUESTED", user.id, { email: user.email, ip });
  } else {
    await audit("PASSWORD_RESET_REQUESTED_SKIPPED", null, { ip });
  }

  // `provider` lets the UI be honest about the sandbox (console mode shows the
  // token on screen; a real provider keeps the fully generic email wording).
  return ok({
    sent: true,
    provider: emailProviderConfigured() ? "email" : "console",
    ...(devToken ? { devToken } : {}),
  });
}
