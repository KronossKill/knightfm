// Knight FM — VPN exception allow-list (Task 25-d). ADMIN-only CRUD backing
// the security.vpnPolicy engine: exact IPs and IPv4 CIDR ranges that must
// never be VPN-blocked. Same guard pattern as /api/admin/config.
// Data access goes through src/lib/vpn.ts helpers (delegate-first with a
// raw-SQL fallback for long-running dev servers whose PrismaClient predates
// the VpnException migration — see vpn.ts).

import { NextRequest } from "next/server";
import { z } from "zod";
import { audit, fail, isResponse, ok, readJson, requireAuth } from "@/lib/api";
import { loadVpnConfig, invalidateVpnCache, isValidVpnValue, vpnListAll, vpnFindByValue, vpnUpsert, vpnFindById, vpnDeleteById } from "@/lib/vpn";
import { sanitizeText } from "@/lib/security";

export const runtime = "nodejs";

async function adminGuard(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;
  if (auth.role !== "ADMIN") return fail("FORBIDDEN", "Admin access required", 403);
  return auth;
}

// ─── GET: list exceptions (createdAt desc) + current policy ───────

export async function GET(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const [exceptions, vpn] = await Promise.all([vpnListAll(), loadVpnConfig()]);

  return ok({ exceptions, policy: vpn.policy, detectUrl: vpn.detectUrl });
}

// ─── POST: upsert one exception by its unique value ───────────────

const PostBody = z.object({
  value: z.string().trim().min(1).max(64),
  note: z.string().max(140).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const parsed = PostBody.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("INVALID_IP", "Value must be an exact IPv4/IPv6 address or an IPv4 CIDR (a.b.c.d/0-32)", 400);
  const value = parsed.data.value.trim();
  const note = sanitizeText(parsed.data.note ?? "", 140);

  // Exact IPv4, exact IPv6 or IPv4 CIDR /0../32 (shared parser with the
  // matcher, so anything accepted here is guaranteed to match in isExcepted).
  if (!isValidVpnValue(value)) {
    return fail("INVALID_IP", "Value must be an exact IPv4/IPv6 address or an IPv4 CIDR (a.b.c.d/0-32)", 400, { value });
  }

  const existing = await vpnFindByValue(value);
  const row = await vpnUpsert(value, note, auth.userId);

  // Cached matches must reflect this write immediately.
  invalidateVpnCache();
  await audit("VPN_EXCEPTION_ADD", auth.userId, {
    value,
    note,
    updated: !!existing,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
  });

  return ok(row);
}

// ─── DELETE: remove one exception by id (?id=...) ─────────────────

export async function DELETE(req: NextRequest) {
  const auth = await adminGuard(req);
  if (isResponse(auth)) return auth;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return fail("INVALID_IP", "Query parameter id is required", 400);

  const existing = await vpnFindById(id);
  if (!existing) return fail("NOT_FOUND", "Exception not found", 404, { id });

  await vpnDeleteById(id);

  invalidateVpnCache();
  await audit("VPN_EXCEPTION_REMOVE", auth.userId, { id, value: existing.value });

  return ok({ deleted: true });
}
