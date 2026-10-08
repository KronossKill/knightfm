"use client";
// Knight FM — Personal wallet view (Task 4-c + 9-a). Balance, honest price status (never
// fabricated), Solana-bound deposit flow with gross/levy/net preview and PENDING /
// 503 honesty, withdrawal with client-side base58 length hint only (server does the
// crypto validation), personal ledger and the market-risk notice.
// 9-a: deposits are LEVY-FREE (server credits the full gross) — the preview shows levy 0
// and carries an explicit note; old ledger rows with a levy keep rendering their split.

import "@/lib/i18n/dict/markets";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowDownToLine, ArrowUpFromLine, Check, Copy, Info, Loader2, QrCode, ShieldAlert, TrendingUp, Wallet,
} from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError, EnsureQueryProvider } from "@/components/game/markets/club-context";
import type { DepositResult, LedgerRow, WalletPrice, WalletState } from "@/components/game/markets/types";

interface DepositAttempt {
  signature: string;
  at: string;
  status: "PENDING" | "CREDITED" | "REJECTED" | "UNAVAILABLE" | "DUPLICATE";
  detail: string;
}

function WalletInner() {
  const { t, formatCurrency, formatUsd } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch<WalletState>("/api/wallet"),
    refetchInterval: 60_000,
  });

  const price = useQuery({
    queryKey: ["wallet", "price"],
    queryFn: () => apiFetch<WalletPrice>("/api/wallet/price"),
    staleTime: 60_000,
    retry: false,
  });

  return (
    <section aria-label={t("markets.wallet.title")} className="space-y-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">{t("markets.wallet.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("markets.wallet.subtitle")}</p>
      </header>

      {/* Balance + price */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-transparent">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("markets.wallet.balanceCard")}</p>
              {wallet.isLoading ? (
                <Skeleton className="mt-1 h-8 w-40" />
              ) : (
                <p className="truncate text-2xl font-bold text-primary">
                  {formatCurrency(wallet.data?.balance ?? 0)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
              <TrendingUp className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("markets.wallet.priceTitle")}</p>
              {price.isLoading ? (
                <Skeleton className="mt-1 h-6 w-32" />
              ) : price.data?.available ? (
                <>
                  <p className="truncate text-lg font-bold">
                    {t("markets.wallet.priceValue", { price: formatUsd(price.data.price) })}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("markets.wallet.priceSource", { source: price.data.source })}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{t("markets.wallet.priceUnavailable")}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DepositCard
          onWalletChanged={() => queryClient.invalidateQueries({ queryKey: ["wallet"] })}
          depositAddress={wallet.data?.depositAddress ?? null}
          mint={wallet.data?.mint ?? null}
          solanaPayUri={wallet.data?.solanaPayUri ?? null}
          addressLoading={wallet.isLoading}
        />
        <WithdrawCard
          onWalletChanged={() => queryClient.invalidateQueries({ queryKey: ["wallet"] })}
          minWithdraw={wallet.data?.minWithdraw ?? 50}
        />
      </div>

      {/* Personal ledger */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-semibold">{t("markets.wallet.personalLedger")}</p>
          {wallet.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (wallet.data?.ledger.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("markets.wallet.ledgerEmpty")}</p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader className="sticky top-0 bg-background/95 backdrop-blur">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">{t("common.date")}</TableHead>
                    <TableHead className="whitespace-nowrap">{t("common.status")}</TableHead>
                    <TableHead className="whitespace-nowrap text-right">{t("common.amount")}</TableHead>
                    <TableHead className="whitespace-nowrap text-right">{t("markets.treasury.balanceAfter")}</TableHead>
                    <TableHead className="min-w-48 whitespace-nowrap">{t("markets.treasury.memo")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet.data!.ledger.map((row) => (
                    <PersonalLedgerRow key={row.id} row={row} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk notice */}
      <Alert className="border-amber-500/40 bg-amber-500/10">
        <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
        <AlertTitle className="text-amber-200">{t("markets.wallet.riskNotice")}</AlertTitle>
      </Alert>
    </section>
  );
}

function PersonalLedgerRow({ row }: { row: LedgerRow }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const categoryKey = `ledger.entry.${row.category}`;
  const label = t(categoryKey).startsWith("ledger.entry.") ? row.category : t(categoryKey);
  const positive = row.amount >= 0;
  const hasSplit = typeof row.grossAmount === "number" && row.grossAmount > 0;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit border-border bg-muted/40 text-xs">
            {label}
          </Badge>
          {hasSplit && (
            <span className="text-[11px] text-muted-foreground">
              {t("markets.wallet.grossLevyNet", {
                gross: formatCurrency(row.grossAmount ?? 0),
                levy: formatCurrency(row.levyAmount ?? 0),
                net: formatCurrency(row.netAmount ?? 0),
              })}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={`whitespace-nowrap text-right font-mono text-sm font-semibold ${positive ? "text-primary" : "text-destructive"}`}>
        {positive ? "+" : ""}
        {formatCurrency(row.amount)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right font-mono text-xs text-muted-foreground">
        {formatCurrency(row.balanceAfter)}
      </TableCell>
      <TableCell className="max-w-64 truncate text-xs text-muted-foreground" title={row.memo}>
        {row.memo}
      </TableCell>
    </TableRow>
  );
}

// ─── Deposit card ─────────────────────────────────────────────────

/** Task 57 — monospace, chunked deposit-address row with one-click copy. */
function CopyableAddress({ value, label }: { value: string; label: string }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be denied (permissions / http): fall back to a hidden
      // textarea so the copy still works on older or hardened browsers.
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    toast({ description: t("markets.wallet.depositCopied", { label }) });
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="group flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-2.5 py-2 text-left transition-colors duration-200 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-label={`${label}: ${value}. ${t("markets.wallet.depositCopyAddress")}`}
    >
      <span className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-foreground">{value}</span>
      {copied ? (
        <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
      ) : (
        <Copy aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
      )}
    </button>
  );
}

function DepositCard({
  onWalletChanged,
  depositAddress,
  mint,
  solanaPayUri,
  addressLoading,
}: {
  onWalletChanged: () => void;
  depositAddress: string | null;
  mint: string | null;
  solanaPayUri: string | null;
  addressLoading: boolean;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const [signature, setSignature] = useState("");
  const [attempts, setAttempts] = useState<DepositAttempt[]>([]);

  const [previewAmount, setPreviewAmount] = useState("");
  const previewGross = Math.max(0, Math.floor(Number(previewAmount) || 0));
  // 9-a policy: deposits into the platform are LEVY-FREE — the server credits the full
  // gross (the deposit route hardcodes levy = 0). Old ledger rows may still show a levy.
  const previewLevy = 0;
  const previewNet = previewGross - previewLevy;

  const deposit = useMutation({
    mutationFn: () => apiFetch<DepositResult>("/api/wallet/deposit", { method: "POST", body: { signature: signature.trim() } }),
    onSuccess: (res, _v, _c) => {
      const sig = `${signature.trim().slice(0, 10)}…`;
      if (res.status === "CREDITED") {
        setAttempts((a) => [
          { signature: sig, at: new Date().toISOString(), status: "CREDITED", detail: t("markets.wallet.depositCredited", { gross: res.gross, levy: res.levy, net: res.net }) },
          ...a,
        ]);
        toast({ description: t("markets.wallet.depositCredited", { gross: res.gross, levy: res.levy, net: res.net }) });
        setSignature("");
      } else {
        setAttempts((a) => [
          { signature: sig, at: new Date().toISOString(), status: "PENDING", detail: t("markets.wallet.depositPending") },
          ...a,
        ]);
        toast({ description: t("markets.wallet.depositPending") });
      }
      onWalletChanged();
    },
    onError: (e) => {
      const info = describeError(e);
      const sig = `${signature.trim().slice(0, 10)}…`;
      if (info.code === "DEPOSIT_UNAVAILABLE") {
        setAttempts((a) => [{ signature: sig, at: new Date().toISOString(), status: "UNAVAILABLE", detail: t("markets.wallet.depositUnavailable") }, ...a]);
      } else if (info.code === "DUPLICATE_DEPOSIT") {
        setAttempts((a) => [{ signature: sig, at: new Date().toISOString(), status: "DUPLICATE", detail: t("markets.wallet.depositDuplicate") }, ...a]);
      } else if (info.code === "DEPOSIT_REJECTED") {
        const reason = typeof info.extra.reason === "string" ? info.extra.reason : (info.serverMessage ?? "");
        setAttempts((a) => [{ signature: sig, at: new Date().toISOString(), status: "REJECTED", detail: t("markets.wallet.depositRejected", { reason }) }, ...a]);
      }
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  const sigLen = signature.trim().length;
  const canSubmit = sigLen >= 64 && sigLen <= 88 && !deposit.isPending;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-bold">{t("markets.wallet.depositTitle")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("markets.wallet.depositDesc")}</p>

        {/* Task 57 — system wallet address + QR: invest without complications.
            The address is public on-chain data; the QR carries the Solana Pay
            transfer-request URI so wallets pre-fill recipient + token. */}
        {addressLoading ? (
          <div className="flex items-center gap-4 rounded-lg border p-3">
            <Skeleton className="size-32 shrink-0 rounded-lg" aria-hidden="true" />
            <div className="flex-1 space-y-2" aria-hidden="true">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        ) : depositAddress && solanaPayUri ? (
          <div className="space-y-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
              <h4 className="text-xs font-bold uppercase tracking-wide">{t("markets.wallet.depositQrTitle")}</h4>
              <Badge variant="outline" className="ml-auto border-border bg-muted/40 text-[10px] text-muted-foreground">
                {t("markets.wallet.depositNetwork")}
              </Badge>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div
                className="mx-auto w-fit shrink-0 rounded-lg bg-white p-2 shadow-sm"
                title={t("markets.wallet.depositQrHint")}
              >
                <QRCodeSVG
                  value={solanaPayUri}
                  size={124}
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#09090b"
                  role="img"
                  aria-label={t("markets.wallet.depositQrAlt")}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs text-muted-foreground">{t("markets.wallet.depositQrHint")}</p>
                <CopyableAddress value={depositAddress} label={t("markets.wallet.depositAddressTitle")} />
                {mint && <CopyableAddress value={mint} label={t("markets.wallet.depositMintLabel")} />}
                <p className="text-[11px] text-muted-foreground">{t("markets.wallet.depositSolanaPayNote")}</p>
              </div>
            </div>
          </div>
        ) : (
          <Alert className="border-amber-500/40 bg-amber-500/10 py-2">
            <Info className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <AlertDescription className="text-xs">{t("markets.wallet.depositNoAddress")}</AlertDescription>
          </Alert>
        )}

        {/* Levy preview */}
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <div className="space-y-1.5">
            <Label htmlFor="deposit-preview">{t("common.amount")}</Label>
            <Input
              id="deposit-preview"
              type="number"
              min={0}
              inputMode="numeric"
              value={previewAmount}
              onChange={(e) => setPreviewAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-card p-2">
              <dt className="text-muted-foreground">{t("markets.wallet.previewGross")}</dt>
              <dd className="font-mono font-semibold">{formatCurrency(previewGross)}</dd>
            </div>
            <div className="rounded-md bg-card p-2">
              <dt className="text-muted-foreground">{t("markets.wallet.previewLevy")}</dt>
              <dd className="font-mono font-semibold text-destructive">−{formatCurrency(previewLevy)}</dd>
            </div>
            <div className="rounded-md bg-card p-2">
              <dt className="text-muted-foreground">{t("markets.wallet.previewNet")}</dt>
              <dd className="font-mono font-semibold text-primary">{formatCurrency(previewNet)}</dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground">{t("markets.wallet.depositLevyFree")}</p>
          <p className="text-[11px] text-muted-foreground">{t("markets.wallet.previewCaption")}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="deposit-signature">{t("markets.wallet.depositSignature")}</Label>
          <Input
            id="deposit-signature"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Base58 64–88"
            aria-describedby="deposit-signature-hint"
            className="font-mono text-xs"
          />
          <p id="deposit-signature-hint" className="text-xs text-muted-foreground">
            {t("markets.wallet.depositSignatureHint")}
          </p>
        </div>

        <Button className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!canSubmit} onClick={() => deposit.mutate()}>
          {deposit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("markets.action.deposit")}
        </Button>

        <Alert className="border-border bg-muted/40 py-2">
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs">{t("markets.wallet.depositNote")}</AlertDescription>
        </Alert>

        {/* Last deposit results */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{t("markets.wallet.lastDeposits")}</p>
          <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
            {attempts.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("markets.wallet.noDeposits")}</p>
            ) : (
              attempts.map((a, i) => (
                <div key={`${a.at}-${i}`} className="flex items-start justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{a.signature}</p>
                    <p className="text-xs">{a.detail}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] ${
                      a.status === "CREDITED"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : a.status === "PENDING"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                    }`}
                  >
                    {a.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Withdraw card ────────────────────────────────────────────────

function WithdrawCard({ onWalletChanged, minWithdraw }: { onWalletChanged: () => void; minWithdraw: number }) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "unavailable" | "signing"; text: string } | null>(null);
  // The admin-configured minimum (server truth). If the server ever rejects with
  // BELOW_MIN_WITHDRAW, the authoritative value from the response updates the form.
  const [serverMin, setServerMin] = useState<number | null>(null);
  const effectiveMin = serverMin ?? minWithdraw;

  // Honest client-side hint ONLY (base58 length); the server performs the
  // cryptographic ed25519 validation (base58 → exactly 32 bytes).
  const addr = address.trim();
  const addrLen = addr.length;
  const addrPlausible = addrLen >= 32 && addrLen <= 44 && !/[0OIl]/.test(addr);

  const withdraw = useMutation({
    mutationFn: () =>
      apiFetch<{ amount: number; status: string }>("/api/wallet/withdraw", {
        method: "POST",
        body: { address: addr, amount: Math.floor(Number(amount)) },
      }),
    onSuccess: (res) => {
      if (res.status === "NEEDS_SIGNING") {
        setNotice({ kind: "signing", text: t("markets.wallet.needsSigning") });
        toast({ description: t("markets.wallet.needsSigning") });
      } else {
        setNotice({ kind: "ok", text: t("markets.wallet.withdrawSuccess", { amount: formatCurrency(res.amount) }) });
        toast({ description: t("markets.wallet.withdrawSuccess", { amount: formatCurrency(res.amount) }) });
      }
      onWalletChanged();
    },
    onError: (e) => {
      const info = describeError(e);
      if (info.code === "WITHDRAWAL_UNAVAILABLE") {
        setNotice({ kind: "unavailable", text: t("markets.wallet.withdrawUnavailable") });
      } else {
        setNotice(null);
      }
      if (info.code === "BELOW_MIN_WITHDRAW") {
        const srvMin = typeof info.extra?.minWithdraw === "number" ? info.extra.minWithdraw : null;
        if (srvMin != null) setServerMin(srvMin);
      }
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  const amountNum = Math.floor(Number(amount));
  const canSubmit = addrPlausible && Number.isFinite(amountNum) && amountNum >= effectiveMin && !withdraw.isPending;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <ArrowUpFromLine className="h-5 w-5 text-amber-300" aria-hidden="true" />
          <h3 className="text-sm font-bold">{t("markets.wallet.withdrawTitle")}</h3>
        </div>
        <p className="text-xs text-muted-foreground">{t("markets.wallet.withdrawDesc")}</p>

        <div className="space-y-2">
          <Label htmlFor="withdraw-address">{t("markets.wallet.destination")}</Label>
          <Input
            id="withdraw-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Base58 32–44"
            aria-describedby="withdraw-address-hint"
            aria-invalid={addr !== "" && !addrPlausible}
            className="font-mono text-xs"
          />
          <p id="withdraw-address-hint" className="text-xs text-muted-foreground">
            {t("markets.wallet.addressHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="withdraw-amount">{t("common.amount")}</Label>
          <Input
            id="withdraw-amount"
            type="number"
            min={effectiveMin}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby="withdraw-amount-hint"
          />
          <p id="withdraw-amount-hint" className="text-xs text-muted-foreground">
            {t("markets.wallet.minWithdraw", { min: formatCurrency(effectiveMin) })}
          </p>
        </div>

        <Button className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={!canSubmit} onClick={() => withdraw.mutate()}>
          {withdraw.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          {t("markets.action.withdraw")}
        </Button>

        {notice?.kind === "unavailable" && (
          <Alert className="border-destructive/40 bg-destructive/10">
            <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
            <AlertDescription className="text-xs">{notice.text}</AlertDescription>
          </Alert>
        )}
        {notice?.kind === "signing" && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <Info className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <AlertDescription className="text-xs">{notice.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

/** WalletView — exported shell contract: no props. */
export default function WalletView() {
  return (
    <EnsureQueryProvider>
      <WalletInner />
    </EnsureQueryProvider>
  );
}
