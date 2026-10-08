// Knight FM — Personal wallet view (spec §24). Personal ledger is SEPARATE from club treasury.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAuth, isResponse } from "@/lib/api";
import { getConfig, getInt } from "@/lib/config";
import { isValidSolanaAddress } from "@/lib/solana/solana-verify";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const [wallet, ledger, systemWallet, mint, priceUrl, minWithdraw] = await Promise.all([
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

  // Task 57 — the deposit destination is PUBLIC on-chain information: users must
  // see the system wallet address (and its QR / Solana Pay URI) to invest without
  // friction. Only cryptographically valid addresses are ever exposed.
  const depositAddress = systemWallet && isValidSolanaAddress(systemWallet) ? systemWallet : null;
  const mintValid = mint && isValidSolanaAddress(mint) ? mint : null;
  // Solana Pay transfer-request URI (SPL token): wallets like Phantom/Solflare
  // pre-fill recipient + token when the QR is scanned.
  const solanaPayUri = depositAddress ? `solana:${depositAddress}${mintValid ? `?spl-token=${mintValid}` : ""}` : null;

  return ok({
    balance: wallet?.balance ?? 0,
    ledger,
    depositAddressConfigured: !!systemWallet,
    depositAddress,
    mint: mintValid,
    solanaPayUri,
    priceAvailable: !!priceUrl,
    // Admin-configured minimum for Solana withdrawals (server-enforced too).
    minWithdraw: minWithdraw > 0 ? minWithdraw : 50,
  });
}
