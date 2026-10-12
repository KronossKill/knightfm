// Knight FM — GET /api/auth/availability (Task 108, USER MANDATE).
// Live username/email availability for the registration form: the client fires
// debounced requests WHILE the user types, so duplicates surface before the
// submit click ("la comprobación debe suceder desde que el usuario lo está
// escribiendo"). The DB UNIQUE index stays the final arbiter under races.
//
// Anti-enumeration posture (deliberate trade-off, owner-mandated): only exact
// matches answer "taken" — no wildcard/probing, no user data beyond the
// boolean, and the endpoint is heavily rate-limited per IP.

import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail, rateLimit, clientIp } from "@/lib/api";
import { db } from "@/lib/db";
import { EmailSchema, UsernameSchema } from "../_shared";

export const runtime = "nodejs";

const Query = z
  .object({
    username: z.string().max(64).optional(),
    email: z.string().max(254).optional(),
  })
  .refine((q) => !!q.username !== !!q.email, "exactly one of username|email is required");

export async function GET(req: NextRequest) {
  const ip = clientIp(req);

  // Typing cadence with 450 ms debounce is ~2 req/field at most; 90/3 min per
  // IP is comfortable for honest users and hostile to enumeration scripts.
  const rl = rateLimit(`avail:${ip}`, 90, 3 * 60_000);
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many availability checks", 429, { retryAfterSec: rl.retryAfterSec });
  }

  const params = new URL(req.url).searchParams;
  const parsed = Query.safeParse({
    username: params.get("username") ?? undefined,
    email: params.get("email") ?? undefined,
  });
  if (!parsed.success) {
    return fail("BAD_REQUEST", "Provide exactly one of: username, email", 400);
  }

  if (parsed.data.username !== undefined) {
    const value = UsernameSchema.safeParse(parsed.data.username);
    if (!value.success) {
      return ok({ field: "username", available: false, reason: "INVALID_FORMAT" });
    }
    // Case-insensitive exact match (SQLite LIKE is ASCII-insensitive, same
    // technique as the register route's duplicate check).
    const candidates = await db.user.findMany({
      where: { username: { contains: value.data } },
      select: { username: true },
      take: 200,
    });
    const taken = candidates.some((c) => c.username.toLowerCase() === value.data.toLowerCase());
    return ok({ field: "username", available: !taken, reason: taken ? "TAKEN" : "OK" });
  }

  const email = EmailSchema.safeParse(parsed.data.email!);
  if (!email.success) {
    return ok({ field: "email", available: false, reason: "INVALID_FORMAT" });
  }
  // Emails are stored lowercase at creation (EmailSchema lowercases), so an
  // exact findUnique is a full case-insensitive check.
  const existing = await db.user.findUnique({ where: { email: email.data }, select: { id: true } });
  return ok({ field: "email", available: !existing, reason: existing ? "TAKEN" : "OK" });
}
