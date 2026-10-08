// Knight FM — Messaging (spec §28). Thread list with unread counts + send message.

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, rateLimit, readJson } from "@/lib/api";
import { sanitizeText } from "@/lib/security";

// GET /api/messages?box=inbox|sent — threads grouped by counterpart with unread counts.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const box = new URL(req.url).searchParams.get("box") === "sent" ? "sent" : "inbox";
  const filter = box === "sent" ? { fromUserId: auth.userId } : { toUserId: auth.userId };

  const recent = await db.message.findMany({
    where: filter,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  interface Thread { userId: string; lastBody: string; lastAt: Date; total: number; unread: number }
  const threads = new Map<string, Thread>();
  for (const m of recent) {
    const otherId = box === "sent" ? m.toUserId : m.fromUserId;
    let t = threads.get(otherId);
    if (!t) {
      t = { userId: otherId, lastBody: m.body, lastAt: m.createdAt, total: 0, unread: 0 };
      threads.set(otherId, t);
    }
    t.total++;
    if (box === "inbox" && !m.readAt) t.unread++;
  }

  const counterpartIds = [...threads.keys()];
  const users = await db.user.findMany({
    where: { id: { in: counterpartIds } },
    select: { id: true, username: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.username]));

  const items = [...threads.values()]
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .map((t) => ({ ...t, username: nameById.get(t.userId) ?? null }));

  return ok({ box, items });
}

// POST /api/messages — send a message (rate limited 30/10min).
const Body = z.object({
  toUserId: z.string().min(10).max(64),
  body: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rl = rateLimit(`msg:${auth.userId}`, 30, 10 * 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Message limit reached. Retry in ${rl.retryAfterSec}s`, 429);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "toUserId and body (1–4000 chars) are required", 400);
  const { toUserId } = parsed.data;
  // Hygiene: strip control chars, collapse whitespace, cap at the zod max.
  // SECURITY (pentest hardening): chat is plain text — strip HTML-delimiting
// angle brackets at the perimeter so the payload can never reach a non-React
// sink (email digests, exports). React JSX escaping remains the second layer.
const text = sanitizeText(parsed.data.body, 4000)
  .replace(/</g, "‹")
  .replace(/>/g, "›");
  if (text.length === 0) {
    return fail("BAD_REQUEST", "Message body cannot be empty", 400);
  }

  if (toUserId === auth.userId) return fail("CANNOT_SELF_MESSAGE", "You cannot message yourself", 400);
  const recipient = await db.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!recipient) return fail("RECIPIENT_NOT_FOUND", "Recipient does not exist", 404);

  const message = await db.message.create({ data: { fromUserId: auth.userId, toUserId, body: text } });
  await db.notification.create({
    data: {
      userId: toUserId,
      typeKey: "MSG_RECEIVED",
      payload: JSON.stringify({ messageId: message.id, fromUserId: auth.userId }),
    },
  });

  // Audit intentionally excludes message content (privacy).
  await audit("MESSAGE_SENT", auth.userId, { toUserId, messageId: message.id });
  return ok({ messageId: message.id, sentAt: message.createdAt });
}
