// Knight FM — Public captcha configuration (D-004).
// Single source of truth for BOTH sides of the captcha handshake: the client
// reads this at RUNTIME (no build-time NEXT_PUBLIC_ inlining race) and renders
// Turnstile only when the server is actually ready to verify it. The site key
// is public by design; the secret never leaves the server.

import { NextRequest } from "next/server";
import { ok, rateLimit, clientIp } from "@/lib/api";
import { captchaPublicConfig } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const rl = rateLimit(`capcfg:${clientIp(req)}`, 30, 5 * 60_000);
  if (!rl.allowed) return ok({ provider: "sandbox", siteKey: null });
  return ok(await captchaPublicConfig());
}
