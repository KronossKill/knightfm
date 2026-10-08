// Knight FM — POST /api/admin/promote (ADMIN only).
// Grants or revokes the ADMIN role for a user by email. Every change is audited.
// The Control Center ("Knight Control Center") is accessible only to ADMIN users;
// access is bootstrapped via the admin.bootstrapEmail config key at registration
// and can be adjusted here without any code changes.

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, clientIp, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const promoteSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254),
  role: z.enum(["ADMIN", "USER"]),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const parsed = promoteSchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid body", 400);
  }
  const { email, role } = parsed.data;

  // Case-insensitive lookup (emails are stored lowercase).
  const candidates = await db.user.findMany({
    where: { email: { contains: email } },
    select: { id: true, email: true, username: true, role: true },
  });
  const user = candidates.find((u) => u.email.toLowerCase() === email);
  if (!user) return fail("USER_NOT_FOUND", "No account matches that email", 404);

  if (user.role === role) {
    return ok({ email: user.email, username: user.username, role: user.role, changed: false });
  }

  // Task 42 (USER MANDATE): administrative accounts are the ONLY accounts
  // allowed to use the same IP as anyone else — they are fully exempt from the
  // one-account-per-IP rule. When a user is GRANTED ADMIN, their stamped
  // registrationIp is cleared so the UNIQUE index stops reserving that IP for
  // them (their registration origin remains in AuditEvent AUTH_REGISTER and in
  // the IpLink evidence table). On revoke (ADMIN→USER) the IP stays NULL: the
  // account becomes a legacy (grandfathered) user, exactly like accounts that
  // predate the rule, and is still fully visible in the admin IP audit.
  await db.user.update({
    where: { id: user.id },
    data: { role, ...(role === "ADMIN" ? { registrationIp: null } : {}) },
  });

  await audit(role === "ADMIN" ? "ADMIN_GRANTED" : "ADMIN_REVOKED", auth.userId, {
    targetUserId: user.id,
    targetEmail: user.email,
    ip: clientIp(req),
    registrationIpCleared: role === "ADMIN",
  });

  return ok({ email: user.email, username: user.username, role, changed: true });
}
