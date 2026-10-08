// Knight FM — Anonymous analytics collection. No PII: emails and email-like values are
// stripped before storage. Returns 204 No Content (nothing to read back).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit, clientIp, getAuth, readJson } from "@/lib/api";

const Body = z.object({
  event: z.string().min(1).max(64).regex(/^[A-Za-z0-9._:-]+$/, "event name may contain letters, digits, dot, colon, underscore, dash"),
  props: z.record(z.string(), z.unknown()).optional(),
  sessionKey: z.string().max(64).optional(),
});

const EMAILISH_KEY = /e-?mail|user_?id$|full_?name|phone|wallet/i;

// SECURITY (pentest fix — disk DoS): props accepted an UNLIMITED number of
// keys (100k-key events @120/min rotable via XFF were inflating SQLite).
// Keys are capped and total serialized size is bounded.
const MAX_PROPS_KEYS = 30;
const MAX_PROPS_BYTES = 8 * 1024;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (typeof value === "string") {
    return value.includes("@") ? "[redacted]" : value.slice(0, 300);
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    let count = 0;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_PROPS_KEYS) { out["[truncated]"] = true; break; }
      if (EMAILISH_KEY.test(k)) { out[k] = "[redacted]"; count++; continue; }
      out[k] = scrub(v, depth + 1);
      count++;
    }
    return out;
  }
  return value;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`an:${clientIp(req)}`, 120, 60_000);
  if (!rl.allowed) return new NextResponse(null, { status: 204 });

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return new NextResponse(null, { status: 204 }); // never leak validation detail to trackers

  const { event, props, sessionKey } = parsed.data;
  const auth = await getAuth(req); // optional attribution; anonymous events are fine

  const scrubbed = scrub(props ?? {}) as Record<string, unknown>;
  const serialized = JSON.stringify(scrubbed);
  if (serialized.length > MAX_PROPS_BYTES) {
    return new NextResponse(null, { status: 204 }); // oversized payload: drop silently
  }

  await db.analyticsEvent.create({
    data: {
      name: event,
      userId: auth?.userId ?? null,
      sessionKey: sessionKey ?? null,
      props: serialized,
    },
  }).catch(() => undefined);

  return new NextResponse(null, { status: 204 });
}
