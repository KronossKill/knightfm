"use client";
// Knight FM — Loans tab (Task 9-a). Open LOAN listings (GET /api/markets/loans):
// PlayerCardView + origin club + fee + duration. If the origin club is one of mine the
// card offers Cancel (POST /api/markets/loan/{id}/cancel, confirm dialog); otherwise it
// offers Take on loan (TakeLoanDialog — club picker when several owned clubs, POST
// /api/markets/loan/{id}/take). CAPACITY_FULL / INSUFFICIENT_FUNDS surface honestly via
// the shared describeError + serverMessage line. The scheduler returns loaned players
// to the origin club automatically when the loan expires.

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, CalendarClock, Loader2, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useAutoSelection, useMarketError, useOwnedClubs } from "../club-context";
import { ClubPickList, PlayerCardView } from "../player-card-view";
import { PlayerProfileDialog } from "../player-profile-dialog";
import type { LoanListing } from "../types";

interface LoansResponse {
  items: LoanListing[];
  total: number;
}

export function LoansTab() {
  const { t, formatCurrency } = useI18n();
  const { ownedClubs } = useOwnedClubs();

  const [search, setSearch] = useState("");
  const [takeTarget, setTakeTarget] = useState<LoanListing | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LoanListing | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const loans = useQuery({
    queryKey: ["markets", "loans"],
    queryFn: () => apiFetch<LoansResponse>("/api/markets/loans"),
  });

  const ownedIds = useMemo(() => new Set(ownedClubs.map((c) => c.id)), [ownedClubs]);

  const items = (loans.data?.items ?? []).filter((l) =>
    (l.player?.name ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="loans-q">{t("markets.filters.search")}</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="loans-q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("common.search")}
              className="pl-8"
              aria-label={t("markets.filters.search")}
            />
          </div>
        </div>
        <Button variant="outline" className="min-h-11" onClick={() => loans.refetch()} aria-label={t("markets.action.refresh")}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {loans.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : loans.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => loans.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.loan.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((l) => {
            const own = !!l.originClub && ownedIds.has(l.originClub.id);
            return (
              <Card key={l.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setProfileId(l.player?.id ?? null)}
                    className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("markets.action.viewProfile")}
                    disabled={!l.player}
                  >
                    {l.player && <PlayerCardView player={l.player} />}
                  </button>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{l.originClub?.name ?? "—"}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{l.durationDays}d</span>
                    </p>
                  </div>

                  <div className="mt-auto space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">{t("markets.loan.feeLabel")}</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(l.price)}</span>
                    </div>
                    {own ? (
                      <Button
                        variant="outline"
                        className="min-h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setCancelTarget(l)}
                      >
                        {t("markets.loan.cancel")}
                      </Button>
                    ) : (
                      <Button
                        className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setTakeTarget(l)}
                      >
                        {t("markets.loan.take")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TakeLoanDialog listing={takeTarget} onDone={() => setTakeTarget(null)} />
      <CancelLoanDialog listing={cancelTarget} onDone={() => setCancelTarget(null)} />
      <PlayerProfileDialog playerId={profileId} open={!!profileId} onOpenChange={(v) => !v && setProfileId(null)} />
    </div>
  );
}

// ─── TakeLoanDialog (DirectBuyDialog pattern) ─────────────────────

function TakeLoanDialog({ listing, onDone }: { listing: LoanListing | null; onDone: () => void }) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const open = !!listing;
  const candidates = useMemo(
    () => ownedClubs.filter((c) => c.id !== listing?.originClub?.id),
    [ownedClubs, listing]
  );
  const session = open ? `${listing?.id ?? "none"}:${candidates.map((c) => c.id).join("+")}` : "closed";
  const autoClub = candidates.length === 1 ? candidates[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ untilDay: number }>(`/api/markets/loan/${listing!.id}/take`, {
        method: "POST",
        body: { clubId: clubId ?? undefined },
      }),
    onSuccess: (res) => {
      toast({ description: t("markets.loan.takeSuccess", { day: res.untilDay }) });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      onDone();
    },
    onError: (e) => {
      // CAPACITY_FULL / INSUFFICIENT_FUNDS / NOT_AVAILABLE … surface honestly.
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  const canSubmit = !!clubId && !!listing && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onDone()}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.loan.takeTitle", { player: listing?.player?.name ?? "" })}>
        <DialogHeader>
          <DialogTitle>{t("markets.loan.takeTitle", { player: listing?.player?.name ?? "—" })}</DialogTitle>
          <DialogDescription>{t("markets.loan.takeDesc")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{listing?.player?.name ?? "—"}</p>
          <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(listing?.price ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("markets.loan.durationLabel")}: {listing?.durationDays ?? 0}d · {listing?.originClub?.name ?? "—"}
          </p>
        </div>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("markets.err.clubRequired")}</p>
        ) : (
          candidates.length > 1 && (
            <div className="space-y-2">
              <Label id="loan-borrower-label">{t("markets.direct.buyer")}</Label>
              <ClubPickList clubs={candidates} value={clubId} onChange={setClubId} labelId="loan-borrower-label" />
              {!clubId && <p className="text-xs text-muted-foreground">{t("markets.direct.chooseClub")}</p>}
            </div>
          )
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onDone} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.loan.take")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cancel confirmation (own-club listings) ──────────────────────

function CancelLoanDialog({ listing, onDone }: { listing: LoanListing | null; onDone: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();

  const cancel = useMutation({
    mutationFn: () => apiFetch(`/api/markets/loan/${listing!.id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast({ description: t("markets.loan.cancelSuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      onDone();
    },
    onError: (e) => {
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ? t("markets.err.serverMessage", { message: info.serverMessage }) : undefined,
      });
    },
  });

  return (
    <AlertDialog open={!!listing} onOpenChange={(v) => !v && onDone()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("markets.loan.cancelTitle", { player: listing?.player?.name ?? "—" })}</AlertDialogTitle>
          <AlertDialogDescription>{t("markets.loan.cancelDesc")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
            disabled={cancel.isPending || !listing}
            onClick={(e) => {
              e.preventDefault();
              cancel.mutate();
            }}
          >
            {cancel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.loan.cancel")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
