// Knight FM — Knight Assistant conversation history (last 20 entries).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rows = await db.assistantEntry.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok({
    items: rows.reverse().map((e) => ({
      id: e.id, role: e.role, content: e.content, screen: e.screen, createdAt: e.createdAt,
    })),
  });
}
