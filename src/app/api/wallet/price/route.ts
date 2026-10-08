// Knight FM — $Knight market price. HONEST: with no configured price source and no
// manual rate we return available:false and never fabricate numbers.
// Resolution order (shared with /api/world/state): detected price source (solana.price.url,
// 5-minute cache) → manual admin rate (economy.knightUsdCents) → unavailable.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { getConfig } from "@/lib/config";
import { getKnightUsd } from "@/lib/engine/knight-usd";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const url = await getConfig("solana.price.url");
  const rate = await getKnightUsd();
  if (rate.cents == null) {
    return ok({
      available: false,
      reason: url ? "PRICE_SOURCE_UNAVAILABLE" : "PRICE_SOURCE_NOT_CONFIGURED",
    });
  }

  const price = rate.cents / 100; // USD per 1 $Knight
  const source = rate.source === "oracle" ? "CONFIGURED_URL" : "MANUAL_CONFIG";

  // Integer price × 1000 snapshot for auditability (PriceSnapshot.priceX1000).
  // Only DETECTED prices are snapshotted — the manual rate is already persisted in config.
  if (rate.source === "oracle") {
    // SECURITY (pentest fix — unbounded inserts): every GET inserted a
    // PriceSnapshot row. Deduplicate: at most one snapshot per 5 minutes.
    const last = await db.priceSnapshot.findFirst({ orderBy: { capturedAt: "desc" }, select: { capturedAt: true } }).catch(() => null);
    if (!last || Date.now() - last.capturedAt.getTime() > 5 * 60_000) {
      const priceX1000 = Math.round(price * 1000);
      await db.priceSnapshot
        .create({ data: { source: "CONFIGURED_URL", priceX1000, confidence: "OK" } })
        .catch(() => undefined);
    }
  }

  return ok({ available: true, price, priceX1000: Math.round(price * 1000), source, capturedAt: new Date().toISOString() });
}
