// Knight FM — DELETE /api/user/account (Task 52-c, GDPR art. 17 right to erasure).
// Self-service account deletion: closes the "derecho al olvido" promised by the
// Privacy Policy §7.1 end-to-end. The user re-authenticates with their password
// (Argon2, timing-equalized) and the EXACT teardown of the daily inactivity
// engine (src/lib/engine/inactivity.ts) runs: owned clubs revert to the system
// with their original founding name, managed clubs are released, all personal
// data (sessions, wallet, notifications, assistant log, presence, messages,
// contracts/permission grants) is erased — inside one transaction, fully
// audited (USER_DELETED with the user themself as actor + USER_SELF_DELETE).
// ADMIN accounts are permanent (Tasks 42/43) and can NEVER be deleted here.

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse, audit, rateLimit, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPassword, fakePasswordVerify } from "@/lib/auth";
import { currentGameDay } from "@/lib/engine/clock";
import { deleteUserAccount } from "@/lib/engine/inactivity";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  password: z.string().min(1).max(200),
});

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  // ADMIN accounts are permanent (user mandate, Tasks 42/43): no self-deletion,
  // ever. Honest machine code so the client can show an explicit message.
  if (auth.role === "ADMIN") {
    return fail("ADMIN_CANNOT_DELETE", "Administrator accounts cannot be deleted", 403);
  }

  // Strict rate limit: 3 attempts per hour per userId (destructive action +
  // online password verification must not be brute-forceable).
  const rl = rateLimit(`acct-delete:${auth.userId}`, 3, 60 * 60 * 1000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429, { retryAfterSec: rl.retryAfterSec });
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, passwordHash: true },
  });
  // SECURITY (same timing-equalization as login): if the row vanished between
  // requireAuth and this lookup, run a real (always-failing) Argon2 verify so
  // the response latency does not disclose account state.
  const passwordOk = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : ((await fakePasswordVerify()), false);
  if (!user || !passwordOk) {
    await audit("USER_SELF_DELETE_DENIED", auth.userId, { reason: "BAD_PASSWORD" });
    return fail("BAD_CREDENTIALS", "Invalid credentials", 401);
  }

  // Current game day for the audit trail — same pattern as the admin route
  // (src/app/api/admin/users/[id]/route.ts): 0 if the world clock is unavailable.
  const day = await currentGameDay().catch(() => 0);

  try {
    // USER_DELETED is audited inside deleteUserAccount with the user as actor.
    // The teardown also deletes every Session row inside the same transaction
    // (verified: inactivity.ts step (c) `tx.session.deleteMany`), so ALL sessions
    // are revoked atomically with the deletion — no extra cleanup needed here.
    const res = await deleteUserAccount(user.id, user.email, day, user.id);
    await audit("USER_SELF_DELETE", user.id, { reason: "self-service" });
    return ok({
      deleted: true,
      clubsReverted: res.clubsReverted,
      note: "All sessions have been revoked. Sign-in with the previous credentials is no longer possible.",
    });
  } catch (e) {
    void audit("USER_DELETE_FAILED", auth.userId, { userId: auth.userId, reason: "self-service", error: String(e) }).catch(() => undefined);
    return fail("USER_DELETE_FAILED", "The account could not be deleted", 500);
  }
}
