// Knight FM — GET/POST /api/admin/moderation (ADMIN only).
// Task 41 (USER MANDATE): when two or more accounts are detected on the SAME
// IP within the configured window (security.ipWindowDays, default 30 days),
// every involved account is auto-BLOCKED with reason MULTI_ACCOUNT_IP. The
// unlock is ADMIN-ONLY — there is no self-service path back. This endpoint is
// that single unlock door, plus a manual moderation block for admins.
//
//   GET                → every BLOCKED account + its IP evidence (IpLink rows)
//   POST action=UNBLOCK → lift the block (status ACTIVE, reason/at cleared)
//   POST action=BLOCK   → manual moderation block (reason ADMIN_MANUAL)
//
// Every action is audited with the acting admin's id. ADMIN accounts can never
// be blocked here (the Control Center must stay reachable).

import { NextRequest } from "next/server";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { db } from "@/lib/db";
import { BLOCK_REASON_ADMIN_MANUAL } from "@/lib/security/ip-guard";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const blocked = await db.user.findMany({
    where: { status: "BLOCKED" },
    orderBy: { blockedAt: "desc" },
    take: 200,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      blockedReason: true,
      blockedAt: true,
      registrationIp: true,
      lastLoginIp: true,
      createdAt: true,
    },
  });

  // IP evidence per blocked account (IpLink rows; most recent first) — the
  // admin sees exactly WHICH connection triggered the rule before deciding to
  // unblock. Kept after an unblock as historical evidence.
  const ids = blocked.map((u) => u.id);
  const links = ids.length
    ? await db.ipLink.findMany({
        where: { userId: { in: ids } },
        orderBy: { lastSeenAt: "desc" },
        select: { userId: true, ip: true, lastSeenAt: true },
      })
    : [];
  const ipsByUser = new Map<string, { ip: string; lastSeenAt: string }[]>();
  for (const l of links) {
    const arr = ipsByUser.get(l.userId) ?? [];
    if (arr.length < 10) arr.push({ ip: l.ip, lastSeenAt: l.lastSeenAt.toISOString() });
    ipsByUser.set(l.userId, arr);
  }

  return ok({
    blocked: blocked.map((u) => ({ ...u, ips: ipsByUser.get(u.id) ?? [] })),
  });
}

const BodySchema = z.object({
  userId: z.string().min(1).max(64),
  action: z.enum(["UNBLOCK", "BLOCK"]),
  note: z.string().trim().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const parsed = BodySchema.safeParse(await readJson<unknown>(req));
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);
  const { userId, action, note } = parsed.data;

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, status: true },
  });
  if (!target) return fail("NOT_FOUND", "User not found", 404);
  // ADMIN accounts are untouchable by moderation actions (staff must always be
  // able to reach the Control Center — same principle as the VPN login bypass).
  if (target.role === "ADMIN" && action === "BLOCK") {
    return fail("FORBIDDEN", "Admin accounts cannot be blocked", 403);
  }

  if (action === "UNBLOCK") {
    if (target.status !== "BLOCKED") {
      return fail("INVALID_STATE", "Account is not blocked", 409);
    }
    await db.user.update({
      where: { id: userId },
      data: { status: "ACTIVE", blockedReason: null, blockedAt: null },
    });
    await audit("ADMIN_UNBLOCK_USER", auth.userId, {
      targetId: target.id,
      username: target.username,
      note: note ?? null,
    });
    return ok({ unblocked: true, userId: target.id });
  }

  // action === "BLOCK" — manual moderation block (distinct machine reason so
  // the client can show the right message; sessions die immediately).
  if (target.status === "BLOCKED") {
    return fail("INVALID_STATE", "Account is already blocked", 409);
  }
  const now = new Date();
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { status: "BLOCKED", blockedReason: BLOCK_REASON_ADMIN_MANUAL, blockedAt: now },
    }),
    db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    }),
  ]);
  await audit("ADMIN_BLOCK_USER", auth.userId, {
    targetId: target.id,
    username: target.username,
    note: note ?? null,
  });
  return ok({ blocked: true, userId: target.id });
}
