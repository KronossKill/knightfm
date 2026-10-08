// Knight FM — Solana boundary (Task 3-b).
// Cryptographic address validation + server-side deposit verification via JSON-RPC.
// HONESTY RULE: nothing is credited without ≥10 passing on-chain validation checks;
// if no RPC is configured the API answers 503 DEPOSIT_UNAVAILABLE — numbers are never faked.

import bs58 from "bs58";
import { getInt, getConfig } from "@/lib/config";

export interface SolanaConfig {
  rpcUrl: string;
  mint: string;
  systemWallet: string;
}

/** Load the on-chain boundary config. Returns null (honest) when any required piece is missing. */
export async function getSolanaConfig(): Promise<SolanaConfig | null> {
  const [rpcUrl, mint, systemWallet] = await Promise.all([
    getConfig("solana.rpc.url"),
    getConfig("solana.mint"),
    getConfig("solana.systemWallet"),
  ]);
  if (!rpcUrl || !mint || !systemWallet) return null;
  return { rpcUrl, mint, systemWallet };
}

/** Ed25519-specific validation: base58-decode must yield exactly 32 bytes (a pubkey). */
export function isValidSolanaAddress(address: string): boolean {
  if (typeof address !== "string" || address.length < 32 || address.length > 44) return false;
  try {
    const bytes = bs58.decode(address);
    return bytes.length === 32;
  } catch {
    return false;
  }
}

export function isValidTxSignature(signature: string): boolean {
  if (typeof signature !== "string" || signature.length < 64 || signature.length > 88) return false;
  try {
    return bs58.decode(signature).length === 64;
  } catch {
    return false;
  }
}

// ─── JSON-RPC ──────────────────────────────────────────────────────

async function rpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`RPC_HTTP_${res.status}`);
  const body = (await res.json()) as { error?: { message: string }; result?: T };
  if (body.error) throw new Error(`RPC_ERROR:${body.error.message}`);
  return body.result as T;
}

interface TokenBalance {
  accountIndex: number;
  mint: string;
  owner: string;
  programId?: string;
  uiTokenAmount: { amount: string; decimals: number; uiAmount: number | null; uiAmountString: string | null };
}

interface ParsedTransaction {
  blockTime: number | null;
  slot: number;
  confirmationStatus?: string;
  meta: {
    err: unknown;
    status?: { Ok: unknown } | { Err: unknown };
    fee: number;
    preTokenBalances: TokenBalance[] | null;
    postTokenBalances: TokenBalance[] | null;
  } | null;
  transaction: {
    message: { accountKeys: Array<{ pubkey: string; signer: boolean; writable: boolean; source?: string }> };
  };
}

export interface DepositCheck { n: number; name: string; passed: boolean; detail?: string }

export interface DepositVerification {
  ok: boolean;
  checks: DepositCheck[];
  amount?: number; // integer $Knight base units
  failureReason?: string;
}

/**
 * Verify a deposit transaction end-to-end (≥10 checks, all must pass):
 *  1 TX_FOUND, 2 TX_SUCCESS, 3 FINALIZED, 4 MINT_MATCH, 5 DEST_OWNER_MATCH,
 *  6 DEST_PLATFORM_TOKEN_ACCOUNT, 7 AMOUNT_POSITIVE_INTEGER, 8 BALANCE_DELTA_MATCH,
 *  9 SIGNATURE_FORMAT, 10 NOT_PREVIOUSLY_CREDITED, 11 BLOCKTIME_SANITY.
 */
export async function verifyDepositTransaction(
  cfg: SolanaConfig,
  signature: string,
  alreadyCredited: boolean
): Promise<DepositVerification> {
  const checks: DepositCheck[] = [];
  const push = (n: number, name: string, passed: boolean, detail?: string) => checks.push({ n, name, passed, detail });

  // [9] signature format (checked before RPC — cheap cryptographic gate)
  const sigOk = isValidTxSignature(signature);
  push(9, "SIGNATURE_FORMAT", sigOk, sigOk ? "base58, 64 bytes" : "not a valid base58 64-byte tx signature");

  // [10] anti-replay against previously credited signatures
  push(10, "NOT_PREVIOUSLY_CREDITED", !alreadyCredited, alreadyCredited ? "signature already credited" : "first credit for signature");

  if (!sigOk) {
    return { ok: false, checks, failureReason: "INVALID_SIGNATURE_FORMAT" };
  }

  let tx: ParsedTransaction | null = null;
  try {
    tx = await rpc<ParsedTransaction | null>(cfg.rpcUrl, "getTransaction", [
      signature,
      { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
    ]);
  } catch (e) {
    return { ok: false, checks, failureReason: `RPC_UNREACHABLE:${String(e).slice(0, 120)}` };
  }

  // [1] tx exists
  push(1, "TX_FOUND", !!tx, tx ? `slot ${tx.slot}` : "transaction not found on-chain");
  if (!tx || !tx.meta) {
    return { ok: false, checks, failureReason: "TX_NOT_FOUND" };
  }

  // [2] success
  const success = tx.meta.err === null || tx.meta.err === undefined;
  push(2, "TX_SUCCESS", success, success ? "meta.err null" : "transaction failed on-chain");

  // [3] finalized commitment
  const finalized = tx.confirmationStatus === "finalized" || (!!tx.meta.status && "Ok" in tx.meta.status && tx.confirmationStatus !== "processed" && tx.confirmationStatus !== "confirmed");
  push(3, "FINALIZED", finalized, `confirmationStatus=${tx.confirmationStatus ?? "unknown"}`);

  const pre = tx.meta.preTokenBalances ?? [];
  const post = tx.meta.postTokenBalances ?? [];

  // Destination candidates: platform wallet's token accounts for the configured mint.
  const destPosts = post.filter((b) => b.mint === cfg.mint && b.owner === cfg.systemWallet);

  // [4] mint match
  push(4, "MINT_MATCH", destPosts.length > 0, destPosts.length > 0 ? `mint ${cfg.mint} present` : "configured mint not found among post token balances");

  // [5] destination owner == platform wallet
  push(5, "DEST_OWNER_MATCH", destPosts.length > 0, destPosts.length > 0 ? `owner == systemWallet` : "no post token balance owned by systemWallet");

  // [6] destination is the platform token account (account index resolves to an account key in the tx)
  const accountKeys = tx.transaction.message.accountKeys.map((k) => k.pubkey);
  const destWithAccount = destPosts.filter((b) => accountKeys[b.accountIndex] !== undefined);
  push(6, "DEST_PLATFORM_TOKEN_ACCOUNT", destWithAccount.length > 0, destWithAccount.length > 0 ? "destination token account present in tx account keys" : "destination token account missing from tx");

  const deltas = destWithAccount.map((b) => {
    const preEntry = pre.find((p) => p.accountIndex === b.accountIndex && p.mint === b.mint);
    const preAmt = BigInt(preEntry?.uiTokenAmount.amount ?? "0");
    const postAmt = BigInt(b.uiTokenAmount.amount);
    return { entry: b, delta: postAmt - preAmt, postAmt };
  });

  const credits = deltas.filter((d) => d.delta > BigInt(0));
  // [7] amount > 0, integer (raw base units are integers by definition; string must be canonical integer)
  const amountOk = credits.length === 1 && /^\d+$/.test(credits[0].entry.uiTokenAmount.amount);
  push(7, "AMOUNT_POSITIVE_INTEGER", amountOk, credits.length === 1 ? `amount ${credits[0].entry.uiTokenAmount.amount}` : `positive deltas: ${credits.length}`);

  // [8] pre/post balance delta == amount
  const deltaMatch = credits.length === 1 && credits[0].delta === BigInt(credits[0].entry.uiTokenAmount.amount);
  push(8, "BALANCE_DELTA_MATCH", deltaMatch, deltaMatch ? "post-pre delta equals credited amount" : "delta mismatch or ambiguous transfer");

  // [11] blockTime sanity: not older than 7 days, not in the future (>5 min skew)
  const nowSec = Math.floor(Date.now() / 1000);
  const bt = tx.blockTime ?? 0;
  const sane = bt > 0 && bt >= nowSec - 7 * 86400 && bt <= nowSec + 300;
  push(11, "BLOCKTIME_SANITY", sane, sane ? new Date(bt * 1000).toISOString() : `blockTime=${tx.blockTime}`);

  if (checks.some((c) => !c.passed)) {
    const firstFail = checks.find((c) => !c.passed)!;
    return { ok: false, checks, failureReason: firstFail.name };
  }

  // Convert base units → $Knight (integer). decimals configurable via solana.mint.decimals (default 0).
  const decimals = await getInt("solana.mint.decimals", 0);
  const base = BigInt(credits[0].entry.uiTokenAmount.amount);
  const divisor = BigInt(10) ** BigInt(decimals);
  const amount = Number(base / divisor);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, checks, failureReason: "AMOUNT_RESOLUTION_FAILED" };
  }
  return { ok: true, checks, amount };
}
