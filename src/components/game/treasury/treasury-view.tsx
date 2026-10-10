"use client";
// Knight FM — Club treasury view (Task 4-c + 9-a + 11). Finance header cards (operating
// fund, debt, finState badge with colors + aria text, unpaidDays warning), invest /
// withdraw dialogs (402 / 403 DEBT_BLOCK surfaced honestly), ledger table (last 50,
// max-h scroll) and the separate-ledgers notice. User mandate 11: INVEST (deposit
// personal funds into the club) is available to the club's OWNER **and MANAGER**;
// WITHDRAW stays owner-only. Both actions are honest internal moves between the two
// separate economies (no levy).

import "@/lib/i18n/dict/markets";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Landmark, Loader2, Scale, Wallet } from "lucide-react";
import { apiFetch, ApiError } from "@/components/auth/store";
import { getCaptchaToken } from "@/components/auth/captcha";
import { useViewStore } from "@/components/game/view-store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError } from "@/components/game/markets/club-context";
import { EnsureQueryProvider } from "@/components/game/markets/club-context";
import type { ClubLite, LedgerRow, TreasuryState, WalletState } from "@/components/game/markets/types";

const FIN_STATE_STYLES: Record<string, { className: string; key: string }> = {
  HEALTHY: { className: "border-primary/40 bg-primary/10 text-primary", key: "markets.treasury.finHealthy" },
  INSOLVENT: { className: "border-amber-500/40 bg-amber-500/10 text-amber-300", key: "markets.treasury.finInsolvent" },
  POSSIBLE_BANKRUPTCY: { className: "border-orange-500/40 bg-orange-500/10 text-orange-300", key: "markets.treasury.finPossibleBankruptcy" },
  BANKRUPT: { className: "border-destructive/40 bg-destructive/10 text-destructive", key: "markets.treasury.finBankrupt" },
};

function TreasuryInner({ club }: { club: ClubLite }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const queryClient = useQueryClient();

  const [investOpen, setInvestOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const treasury = useQuery({
    queryKey: ["treasury", club.id],
    queryFn: () => apiFetch<TreasuryState>(`/api/treasury?clubId=${encodeURIComponent(club.id)}`),
    refetchInterval: 60_000,
  });

  const data = treasury.data;
  const fin = data ? FIN_STATE_STYLES[data.finState] ?? FIN_STATE_STYLES.HEALTHY : null;
  // User mandate: depositing funds into the club is available to OWNER and MANAGER;
  // withdrawing club funds remains owner-only.
  const canInvest = club.role === "OWNER" || club.role === "MANAGER";
  const isOwner = club.role === "OWNER";

  const afterMutation = () => {
    queryClient.invalidateQueries({ queryKey: ["treasury", club.id] });
    queryClient.invalidateQueries({ queryKey: ["markets"] });
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  };

  return (
    <section aria-label={t("markets.treasury.title")} className="space-y-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">{t("markets.treasury.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("markets.treasury.subtitle")}</p>
      </header>

      {treasury.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : treasury.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => treasury.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <>
          {/* Header cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Landmark className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("markets.treasury.operatingFund")}</p>
                  <p className="truncate text-lg font-bold text-primary">{formatCurrency(data.operatingFund)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${data.debt > 0 ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                  <Scale className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("markets.treasury.debt")}</p>
                  <p className={`truncate text-lg font-bold ${data.debt > 0 ? "text-destructive" : ""}`}>
                    {formatCurrency(data.debt)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
                <p className="text-xs text-muted-foreground">{t("markets.treasury.finState")}</p>
                {fin && (
                  <Badge
                    variant="outline"
                    className={`w-fit ${fin.className}`}
                    aria-label={t("markets.treasury.finAria", { state: t(fin.key) })}
                  >
                    {t(fin.key)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Honest warnings */}
          {data.unpaidDays > 0 && (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <AlertDescription>
                {t("markets.treasury.unpaidWarning", { days: data.unpaidDays, mult: 2 })}
              </AlertDescription>
            </Alert>
          )}
          {data.debt > 0 && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
              <AlertDescription>{t("markets.treasury.debtNotice")}</AlertDescription>
            </Alert>
          )}

          {/* Invest (owner or manager) + withdraw (owner-only) actions */}
          {canInvest && (
            <div className="flex flex-wrap gap-3">
              <Button
                className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setInvestOpen(true)}
              >
                <ArrowDownLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("markets.action.invest")}
              </Button>
              {isOwner && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setWithdrawOpen(true)}
                >
                  <ArrowUpRight className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("markets.action.withdraw")}
                </Button>
              )}
              {/* 9-a + 23-b: investing into the club is tax-free; WITHDRAWALS carry the configurable gravamen. */}
              <p className="w-full text-xs text-muted-foreground">{t("markets.treasury.levyNote", { pct: data?.withdrawTaxPct ?? 10 })}</p>
              {/* Task 25-b: honest notice about the gravamen on club INCOME (→ SYSTEM fund). */}
              <p className="w-full text-xs text-muted-foreground">{t("markets.treasury.incomeTaxNote", { pct: data?.incomeTaxPct ?? 10 })}</p>
            </div>
          )}

          {/* Separate ledgers notice */}
          <Card className="border-dashed">
            <CardContent className="flex items-start gap-3 p-4">
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{t("markets.treasury.separateLedgers")}</p>
            </CardContent>
          </Card>

          {/* Ledger */}
          <Card>
            <CardContent className="p-4">
              <p className="mb-3 text-sm font-semibold">{t("markets.treasury.ledger")}</p>
              {data.ledger.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("markets.treasury.ledgerEmpty")}</p>
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
                      {data.ledger.map((row) => (
                        <LedgerRowView key={row.id} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      <MoveFundsDialog
        open={investOpen}
        onOpenChange={setInvestOpen}
        mode="invest"
        club={club}
        withdrawTaxPct={data?.withdrawTaxPct ?? 10}
        onDone={afterMutation}
      />
      <MoveFundsDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        mode="withdraw"
        club={club}
        withdrawTaxPct={data?.withdrawTaxPct ?? 10}
        onDone={afterMutation}
      />
    </section>
  );
}

function LedgerRowView({ row }: { row: LedgerRow }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const categoryKey = `ledger.entry.${row.category}`;
  const label = t(categoryKey).startsWith("ledger.entry.") ? row.category : t(categoryKey);
  const positive = row.amount >= 0;
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatDate(row.createdAt)}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <Badge variant="outline" className="border-border bg-muted/40 text-xs">
          {label}
        </Badge>
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

function MoveFundsDialog({
  open, onOpenChange, mode, club, withdrawTaxPct, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "invest" | "withdraw";
  club: ClubLite;
  /** Task 23-b: tax percentage withheld on club→owner withdrawals. */
  withdrawTaxPct: number;
  onDone: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const [amount, setAmount] = useState("");
  // Task 21: investing with an empty personal wallet offers the recharge escape.
  const [shortFunds, setShortFunds] = useState<{ need: number; have: number } | null>(null);

  // 9-a: invest mode moves money FROM the personal wallet — show its live balance
  // (same shared ["wallet"] query the wallet view uses; only fetched while open).
  const wallet = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiFetch<WalletState>("/api/wallet"),
    enabled: open && mode === "invest",
  });

  const mutation = useMutation({
    mutationFn: async () =>
      apiFetch<{ operatingFund: number; gross?: number; tax?: number; net?: number }>(`/api/treasury/${mode}`, {
        method: "POST",
        // Withdrawals carry a captcha token (same anti-bot gate as wallet withdrawal);
        // invest does not (server Body schema keeps captchaToken optional).
        body: {
          clubId: club.id,
          amount: Math.floor(Number(amount)),
          ...(mode === "withdraw" ? { captchaToken: await getCaptchaToken() } : {}),
        },
      }),
    onSuccess: (res) => {
      toast({
        description:
          mode === "invest"
            ? t("markets.treasury.investSuccess", { fund: formatCurrency(res.operatingFund) })
            : t("markets.treasury.withdrawSuccessNet", {
                net: formatCurrency(res.net ?? Math.floor(Number(amount))),
                tax: formatCurrency(res.tax ?? 0),
                fund: formatCurrency(res.operatingFund),
              }),
      });
      onDone();
      onOpenChange(false);
      setAmount("");
    },
    onError: (e) => {
      // Task 21 — insufficient PERSONAL funds while investing: suggest recharging
      // the wallet instead of a dead-end toast (server message carries need/have).
      if (mode === "invest" && e instanceof ApiError && e.code === "INSUFFICIENT_FUNDS") {
        const m = /need (\d+), have (\d+)/.exec(e.message ?? "");
        setShortFunds({
          need: m ? Number(m[1]) : Math.floor(Number(amount)) || 0,
          have: m ? Number(m[2]) : 0,
        });
        return;
      }
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  const goRecharge = () => {
    setShortFunds(null);
    onOpenChange(false);
    useViewStore.getState().setView("wallet");
  };

  const amountNum = Math.floor(Number(amount));
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !mutation.isPending;
  // Task 23-b: live tax estimate for withdrawals (gravamen, default 10%).
  const withdrawTax = Math.floor((amountNum * Math.max(0, withdrawTaxPct)) / 100);
  const withdrawNet = Math.max(0, amountNum - withdrawTax);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" role="dialog" aria-label={mode === "invest" ? t("markets.treasury.investTitle") : t("markets.treasury.withdrawTitle")}>
        <DialogHeader>
          <DialogTitle>{mode === "invest" ? t("markets.treasury.investTitle") : t("markets.treasury.withdrawTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "invest" ? t("markets.treasury.investDesc") : t("markets.treasury.withdrawDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="treasury-amount">{t("common.amount")}</Label>
          <Input
            id="treasury-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby={mode === "invest" ? "treasury-amount-hint" : undefined}
          />
          {mode === "invest" && (
            <p id="treasury-amount-hint" className="text-xs text-muted-foreground" aria-live="polite">
              {wallet.isLoading
                ? "…"
                : t("markets.treasury.personalBalance", { balance: formatCurrency(wallet.data?.balance ?? 0) })}
            </p>
          )}
          {mode === "withdraw" && amountNum > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs" aria-live="polite">
              <p className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("markets.treasury.taxLabel", { pct: withdrawTaxPct })}</span>
                <span className="font-mono tabular-nums text-amber-300">−{formatCurrency(withdrawTax)}</span>
              </p>
              <p className="mt-1 flex items-center justify-between gap-2 font-medium">
                <span>{t("markets.treasury.netLabel")}</span>
                <span className="font-mono tabular-nums text-primary">{formatCurrency(withdrawNet)}</span>
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSubmit}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {mode === "invest" ? t("markets.action.invest") : t("markets.action.withdraw")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Task 21 — "no tienes fondos" → suggest recharging the personal wallet */}
    <Dialog open={!!shortFunds} onOpenChange={(v) => !v && setShortFunds(null)}>
        <DialogContent className="sm:max-w-sm" role="alertdialog" aria-label={t("markets.treasury.shortTitle")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle aria-hidden="true" className="size-5 text-amber-400" />
              {t("markets.treasury.shortTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("markets.treasury.shortDesc", {
                need: formatCurrency(shortFunds?.need ?? 0),
                have: formatCurrency(shortFunds?.have ?? 0),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" className="min-h-11" onClick={() => setShortFunds(null)}>{t("common.cancel")}</Button>
            <Button
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={goRecharge}
            >
              <Wallet aria-hidden="true" className="mr-2 size-4" />
              {t("markets.treasury.shortCta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** TreasuryView — exported shell contract: ({club}: {club: ClubLite}). */
export default function TreasuryView({ club }: { club: ClubLite }) {
  return (
    <EnsureQueryProvider>
      <TreasuryInner club={club} />
    </EnsureQueryProvider>
  );
}
