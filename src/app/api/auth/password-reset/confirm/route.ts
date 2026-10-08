// Knight FM — POST /api/auth/password-reset/confirm (spec AUTH-07).
// Validates the PASSWORD_RESET token (sha256 at rest), consumes it atomically,
// updates the password under the server-side policy and revokes every session.

import { NextRequest } from "next/server";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { sha256, hashPassword, passwordPolicyError, revokeAllSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { PasswordSchema, TokenSchema, z } from "../../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ token: TokenSchema, newPassword: PasswordSchema });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`pwreset-confirm:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429, { retryAfterSec: rl.retryAfterSec });
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);
  const { token, newPassword } = parsed.data;

  // Policy first so a weak password never burns a valid token.
  const policy = passwordPolicyError(newPassword);
  if (policy) return fail("PASSWORD_POLICY", policy, 400);

  const now = new Date();
  const row = await db.verificationToken.findFirst({
    where: {
      purpose: "PASSWORD_RESET",
      codeHash: sha256(token),
      consumedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!row) {
    await audit("PASSWORD_RESET_FAILED", null, { ip });
    return fail("TOKEN_INVALID", "Invalid, expired or already-used token", 400);
  }

  const consumed = await db.verificationToken.updateMany({
    where: { id: row.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) {
    return fail("TOKEN_INVALID", "Invalid, expired or already-used token", 400);
  }

  const user = await db.user.findUnique({ where: { email: row.email } });
  if (!user) return fail("TOKEN_INVALID", "Invalid, expired or already-used token", 400);

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeAllSessions(user.id);
  await audit("PASSWORD_RESET_COMPLETED", user.id, { ip });

  return ok({ done: true });
}
