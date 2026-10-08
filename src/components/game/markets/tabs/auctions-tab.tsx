"use client";
// Knight FM — Auctions tab (Task 4-c). Live cards with countdown, bid dialog with
// 5%-increment validation, owner create-auction flow and the honest settlement note.

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Gavel, Info, Loader2, RefreshCw, Timer } from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError, useAutoSelection, useOwnedClubs } from "../club-context";
import { ClubPickList, PlayerCardView, useCountdown } from "../player-card-view";
import { CreateAuctionDialog } from "../action-dialogs";
import { PlayerProfileDialog } from "../player-profile-dialog";
import { Pagination } from "./direct-tab";
import type { AuctionItem, ClubLite } from "../types";

export function AuctionsTab({ club }: { club: ClubLite }) {
  const { t, formatCurrency } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [bidTarget, setBidTarget] = useState<AuctionItem | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const auctions = useQuery({
    queryKey: ["markets", "auctions"],
    queryFn: () => apiFetch<{ items: AuctionItem[]; closed: number; settled: number }>("/api/markets/auctions"),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Alert className="flex-1 border-border bg-muted/40 py-2">
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs">{t("markets.auctions.settlementNote")}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => auctions.refetch()} aria-label={t("markets.action.refresh")}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
            disabled={club.role !== "OWNER"}
            title={club.role !== "OWNER" ? t("markets.err.notClubOwner") : undefined}
          >
            <Gavel className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("markets.auctions.createTitle")}
          </Button>
        </div>
      </div>

      {auctions.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      ) : auctions.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => auctions.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (auctions.data?.items.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.auctions.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {auctions.data!.items.map((a) => (
            <AuctionCard
              key={a.listingId}
              item={a}
              viewClubId={club.id}
              onBid={() => setBidTarget(a)}
              onProfile={() => a.player && setProfileId(a.player.id)}
            />
          ))}
        </div>
      )}

      <CreateAuctionDialog open={createOpen} onOpenChange={setCreateOpen} />
      <BidDialog target={bidTarget} onClose={() => setBidTarget(null)} />
      <PlayerProfileDialog playerId={profileId} open={!!profileId} onOpenChange={(v) => !v && setProfileId(null)} />
    </div>
  );
}

function AuctionCard({
  item, viewClubId, onBid, onProfile,
}: {
  item: AuctionItem;
  viewClubId: string;
  onBid: () => void;
  onProfile: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  const { label, expired } = useCountdown(item.expiresAt);
  const current = item.currentHighest ?? item.startPrice;
  const minNext = Math.ceil(current * 1.05);
  const isOwnAuction = item.sellerClub?.id === viewClubId;
  const youLead = item.leaderClubId === viewClubId;

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {item.player ? (
          <button
            type="button"
            onClick={onProfile}
            className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("markets.action.viewProfile")}
          >
            <PlayerCardView player={item.player} />
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <p className="text-muted-foreground">{t("markets.currentBid")}</p>
            <p className="font-bold text-primary">{formatCurrency(current)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {item.bidCount > 0 ? t("markets.auctions.bidCount", { count: item.bidCount }) : t("markets.auctions.noBids")}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-2">
            <p className="text-muted-foreground">{t("markets.auctions.minNext")}</p>
            <p className="font-semibold">{formatCurrency(minNext)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t("markets.auctions.startPrice")}: {formatCurrency(item.startPrice)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Timer className="h-3.5 w-3.5" aria-hidden="true" />
            {t("markets.auctions.timeLeft")}
          </span>
          <span className={`font-mono font-semibold ${expired ? "text-destructive" : "text-foreground"}`}>
            {expired ? t("markets.auctions.expired") : label}
          </span>
        </div>

        {youLead && (
          <p className="rounded-md bg-primary/10 px-2 py-1 text-center text-xs text-primary">
            {t("markets.auctions.youLead")}
          </p>
        )}

        <Button
          className="mt-auto min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={expired || isOwnAuction}
          onClick={onBid}
        >
          {isOwnAuction ? t("markets.direct.ownListing") : t("markets.bid")}
        </Button>
      </CardContent>
    </Card>
  );
}

function BidDialog({ target, onClose }: { target: AuctionItem | null; onClose: () => void }) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const candidates = useMemo(
    () => ownedClubs.filter((c) => c.id !== target?.sellerClub?.id),
    [ownedClubs, target]
  );
  const minAccepted = target ? Math.ceil((target.currentHighest ?? target.startPrice) * 1.05) : 0;
  const session = target ? `${target.listingId}:${candidates.map((c) => c.id).join("+")}` : "closed";
  const autoClub = candidates.length === 1 ? candidates[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);
  const [amount, setAmount] = useAutoSelection(String(minAccepted), session);

  const amountNum = Math.floor(Number(amount));
  const clientValid = Number.isFinite(amountNum) && amountNum >= minAccepted;

  const bid = useMutation({
    mutationFn: () =>
      apiFetch(`/api/markets/auctions/${target!.listingId}/bid`, {
        method: "POST",
        body: { amount: amountNum, clubId: clubId ?? undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      toast({ description: t("markets.auctions.bidSuccess") });
      onClose();
    },
    onError: (e) => {
      const info = describeError(e);
      toast({
        variant: "destructive",
        title: info.message,
        description: info.serverMessage ?? undefined,
      });
    },
  });

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.auctions.bidTitle", { player: target?.player?.name ?? "" })}>
        <DialogHeader>
          <DialogTitle>{t("markets.auctions.bidTitle", { player: target?.player?.name ?? "—" })}</DialogTitle>
          <DialogDescription>
            {t("markets.auctions.bidHint", { min: formatCurrency(minAccepted) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="bid-amount">{t("markets.auctions.bidLabel")}</Label>
            <Input
              id="bid-amount"
              type="number"
              min={minAccepted}
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={amount !== "" && !clientValid}
            />
            {amount !== "" && !clientValid && (
              <p className="text-xs text-destructive">{t("markets.err.bidTooLow", { min: minAccepted })}</p>
            )}
          </div>

          {clubsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : candidates.length === 0 ? (
            <Alert className="border-amber-500/40 bg-amber-500/10">
              <AlertDescription>{t("markets.err.clubRequired")}</AlertDescription>
            </Alert>
          ) : candidates.length > 1 ? (
            <div className="space-y-2">
              <Label id="bid-club-label">{t("markets.direct.buyer")}</Label>
              <ClubPickList clubs={candidates} value={clubId} onChange={setClubId} labelId="bid-club-label" />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!clubId || !clientValid || bid.isPending}
            onClick={() => bid.mutate()}
          >
            {bid.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.bid")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
