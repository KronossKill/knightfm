// Knight FM — Notification feed (latest 30) + bulk mark-as-read.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, readJson } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.notification.count({ where: { userId: auth.userId, readAt: null } }),
  ]);

  return ok({
    items: items.map((n) => ({
      id: n.id, typeKey: n.typeKey, payload: JSON.parse(n.payload || "{}"),
      readAt: n.readAt, createdAt: n.createdAt,
    })),
    unread,
  });
}

const Body = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "ids (array) is required", 400);

  const result = await db.notification.updateMany({
    where: { id: { in: parsed.data.ids }, userId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ marked: result.count });
}
