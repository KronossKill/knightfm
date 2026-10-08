// Knight FM — POST /api/auth/refresh (D-003).
// Rotates the refresh token (server-side hash stored on the session) and issues
// a fresh 15-minute access token. Invalid/revoked/expired tokens → generic 401.

import { NextRequest } from "next/server";
import { ok, fail, audit, clientIp, readJson } from "@/lib/api";
import { rotateRefreshToken, signAccessToken } from "@/lib/auth";
import { evaluateVpn } from "@/lib/vpn";
import { getBool, getConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { z } from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ refreshToken: z.string().min(16).max(256) });

export async function POST(req: NextRequest) {
  // VPN policy guard (Task 25-d): before any token logic. Refresh has NO ADMIN
  // bypass — a stolen refresh token replayed from a VPN exit node must not be
  // exchangeable for fresh access tokens under a "block" policy.
  const ip = clientIp(req);
  const vpn = await evaluateVpn(ip);
  if (vpn.blocked) {
    await audit("VPN_BLOCK", null, { ip, route: "refresh" });
    return fail("VPN_BLOCKED", "Access denied: VPN/proxy detected", 403);
  }
  if (vpn.flagged) {
    // log_only mode or excepted IP: fire-and-forget audit, never blocks.
    void audit("VPN_LOG", null, { ip, route: "refresh", excepted: vpn.excepted }).catch(() => {});
  }

  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION", "Invalid request body", 400);

  const rotated = await rotateRefreshToken(parsed.data.refreshToken, ip);
  if (!rotated) {
    return fail("INVALID_REFRESH_TOKEN", "Invalid or expired session", 401);
  }

  const user = await db.user.findUnique({ where: { id: rotated.userId }, select: { role: true, status: true } });
  if (!user) return fail("INVALID_REFRESH_TOKEN", "Invalid or expired session", 401);

  // Task 41 (anti-multicuenta, defense in depth): a BLOCKED account must never
  // mint fresh access tokens, even if it somehow still holds an unrevoked
  // session row (block transaction racing a concurrent refresh). The client
  // clears auth on this 403 and lands on the login screen.
  if (user.status === "BLOCKED") {
    await audit("AUTH_REFRESH_BLOCKED_ACCOUNT", rotated.userId, { ip });
    return fail("ACCOUNT_BLOCKED", "Account blocked — only an administrator can unblock it", 403);
  }

  // Maintenance gate (Task 27-b): non-ADMIN sessions cannot mint fresh access
  // tokens while maintenance is active. No new token is signed — the client
  // clears auth on the failed refresh and lands on the login screen, which
  // shows the maintenance message. ADMINs pass through (Control Center).
  if (user.role !== "ADMIN" && (await getBool("ops.maintenanceMode"))) {
    return fail("MAINTENANCE", await getConfig("ops.maintenanceMessage"), 503);
  }

  const accessToken = await signAccessToken(rotated.userId, user.role);
  return ok({ accessToken, refreshToken: rotated.refreshToken });
}
