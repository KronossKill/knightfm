// Knight FM — Personal wallet view (spec §24). Personal ledger is SEPARATE from club treasury.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { getConfig, getInt } from "@/lib/config";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const [wallet, ledger, systemWallet, depositMint, priceUrl, minWithdraw] = await Promise.all([
    db.personalWallet.findUnique({ where: { userId: auth.userId }, select: { balance: true } }),
    db.ledgerEntry.findMany({
      where: { account: "PERSONAL", userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, category: true, amount: true, balanceAfter: true, memo: true,
        grossAmount: true, levyAmount: true, netAmount: true, createdAt: true,
      },
    }),
    getConfig("solana.systemWallet"),
    getConfig("solana.mint"),
    getConfig("solana.price.url"),
    getInt("solana.minWithdraw", 50),
  ]);

  return ok({
    balance: wallet?.balance ?? 0,
    ledger,
    depositAddressConfigured: !!systemWallet,
    // Task 88 (USER MANDATE): the SYSTEM DEPOSIT ADDRESS + official mint are
    // exposed so the wallet can show them (with QR + copy button) to investors.
    // Null until the admin configures solana.systemWallet / solana.mint in the
    // Control Center — the UI then shows an honest "not configured" notice.
    depositAddress: systemWallet || null,
    depositMint: depositMint || null,
    priceAvailable: !!priceUrl,
    // Admin-configured minimum for Solana withdrawals (server-enforced too).
    minWithdraw: minWithdraw > 0 ? minWithdraw : 50,
  });
}
