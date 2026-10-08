// Knight FM — POST /api/auth/logout (D-003).
// Revokes the presented refresh token; always responds ok (idempotent).

import { NextRequest } from "next/server";
import { ok, audit, clientIp, getAuth, isResponse, readJson } from "@/lib/api";
import { revokeRefreshToken } from "@/lib/auth";
import { z } from "../_shared";

export const runtime = "nodejs";

const BodySchema = z.object({ refreshToken: z.string().min(16).max(256).optional() });

export async function POST(req: NextRequest) {
  const body = await readJson<unknown>(req);
  const parsed = BodySchema.safeParse(body ?? {});
  const ip = clientIp(req);

  if (parsed.success && parsed.data.refreshToken) {
    await revokeRefreshToken(parsed.data.refreshToken);
  }

  // Attribute the logout when the access token is still readable.
  const auth = await getAuth(req);
  await audit("AUTH_LOGOUT", auth && !isResponse(auth) ? auth.userId : null, { ip });

  return ok({ done: true });
}
