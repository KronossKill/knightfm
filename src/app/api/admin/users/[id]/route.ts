// Knight FM — DELETE /api/admin/users/[id] (ADMIN only, Task 27-b).
// Manual hard-delete of a user account. Reuses the EXACT teardown of the daily
// inactivity engine (src/lib/engine/inactivity.ts): owned clubs revert to the
// system with their original founding name, managed clubs are released, all
// personal data is erased — inside one transaction, fully audited
// (USER_DELETED with the deleting admin as actor). ADMIN targets are refused.

import { NextRequest } from "next/server";
import { ok, fail, requireAuth, isResponse, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { currentGameDay } from "@/lib/engine/clock";
import { deleteUserAccount } from "@/lib/engine/inactivity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const { id } = await params;

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  if (!target) return fail("USER_NOT_FOUND", "User not found", 404);
  if (target.role === "ADMIN") {
    return fail("ADMIN_DELETE_FORBIDDEN", "Administrator accounts cannot be deleted", 403);
  }

  // Current game day for the audit trail (0 if the world clock is unavailable).
  const day = await currentGameDay().catch(() => 0);

  try {
    // USER_DELETED is audited inside deleteUserAccount with auth.userId as actor.
    const res = await deleteUserAccount(id, target.email, day, auth.userId);
    return ok({ deleted: true, clubsReverted: res.clubsReverted });
  } catch (e) {
    void audit("USER_DELETE_FAILED", auth.userId, { userId: id, error: String(e) }).catch(() => undefined);
    return fail("USER_DELETE_FAILED", "The account could not be deleted", 500);
  }
}
