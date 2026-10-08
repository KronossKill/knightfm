// DELETE /api/youth/prospects/[id] — the manager CHOOSES who joins the club and
// who does not (user mandate Task 21): a prospect can be discarded from the
// academy list. Nothing is paid; the row is removed and the action is audited.

import { NextRequest } from "next/server";
import { audit, fail, isResponse, ok, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { getClubAccess } from "@/app/api/_lib/club-access";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const { id } = await params;
  const prospect = await db.youthProspect.findUnique({ where: { id } });
  if (!prospect) return fail("PROSPECT_NOT_FOUND", "Prospect not found", 404);

  const access = await getClubAccess(auth.userId, prospect.clubId);
  if (!access.club) return fail("CLUB_NOT_FOUND", "Club not found", 404);
  if (access.role === "NONE") return fail("FORBIDDEN", "No access to this club", 403);
  if (access.role === "MANAGER" && access.permissions.youth === false) {
    return fail("FORBIDDEN", "Youth permission not granted", 403);
  }

  await db.youthProspect.delete({ where: { id: prospect.id } });

  await audit("YOUTH_REJECTED", auth.userId, {
    clubId: prospect.clubId,
    prospectId: prospect.id,
    name: `${prospect.firstName} ${prospect.lastName}`,
    age: prospect.age,
    quality: prospect.quality,
  });

  return ok({ id: prospect.id, rejected: true });
}
