// Knight FM — Mark received messages as read.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, readJson } from "@/lib/api";

const Body = z.object({ messageIds: z.array(z.string().min(1).max(64)).min(1).max(200) });

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "messageIds (array) is required", 400);

  const result = await db.message.updateMany({
    where: { id: { in: parsed.data.messageIds }, toUserId: auth.userId, readAt: null },
    data: { readAt: new Date() },
  });

  return ok({ marked: result.count });
}
