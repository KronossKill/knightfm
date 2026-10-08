// Knight FM — POST /api/auth/verify-email (spec AUTH-03).
// Consumes the latest valid EMAIL_VERIFY token atomically, marks the email as
// verified and settles pending referral bonuses idempotently. Generic errors
// never reveal whether the email exists.

import { NextRequest } from "next/server";
import { ok, fail, audit, rateLimit, clientIp, readJson } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { db } from "@/lib/db";
import { CodeSchema, EmailSchema, grantReferralBonuses, z } from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ email: EmailSchema, code: CodeSchema });

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = rateLimit(`verify-email:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many attempts", 429, { retryAfterSec: rl.retryAfterSec });
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);
  const emailLc = parsed.data.email.toLowerCase();

  const now = new Date();
  const candidates = await db.verificationToken.findMany({
    where: {
      email: emailLc,
      purpose: "EMAIL_VERIFY",
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const match = candidates.find((t) => t.codeHash === sha256(parsed.data.code));
  if (!match) {
    await audit("EMAIL_VERIFY_FAILED", null, { ip });
    return fail("TOKEN_INVALID", "Invalid, expired or already-used code", 400);
  }

  // Atomic consumption: guarded updateMany prevents double-use under races.
  const consumed = await db.verificationToken.updateMany({
    where: { id: match.id, consumedAt: null },
    data: { consumedAt: now },
  });
  if (consumed.count === 0) {
    return fail("TOKEN_INVALID", "Invalid, expired or already-used code", 400);
  }

  const user = await db.user.findUnique({ where: { email: emailLc } });
  if (!user) return fail("TOKEN_INVALID", "Invalid, expired or already-used code", 400);

  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  // Pending referral bonus (idempotent; deterministic keys per referee).
  const granted = await grantReferralBonuses(user.id);
  if (granted) await audit("EMAIL_VERIFY_REFERRAL_SETTLED", user.id, { referredById: user.referredById });

  await audit("EMAIL_VERIFIED", user.id, { email: emailLc, ip });
  return ok({ verified: true });
}
