// Knight FM — Knight Control Center: audit trail (paginated, optional type filter).

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse } from "@/lib/api";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const rawPage = parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const size = 50;

  const where = type ? { type } : {};
  const [total, rows] = await Promise.all([
    db.auditEvent.count({ where }),
    db.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * size,
      take: size,
    }),
  ]);

  return ok({
    items: rows.map((a) => ({
      id: a.id, type: a.type, actorId: a.actorId,
      payload: JSON.parse(a.payload || "{}"), createdAt: a.createdAt,
    })),
    page, pages: Math.max(1, Math.ceil(total / size)), total,
  });
}
