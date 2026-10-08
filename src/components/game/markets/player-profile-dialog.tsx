"use client";
// Knight FM — player profile dialog (Task 4-c + 9-a). Shared by listing cards and squad
// views. Renders the fields the public/staff API actually returns and shows ONLY
// authorized actions: Sell / Auction / Loan out / Edit clause (owner OR manager of the
// player's club, 2×2 grid), Exercise release clause (another owner's club player), Sign
// (free agent). Never sell+buy on the same view — own-club players never see the clause
// exercise action, foreign players never see sell/auction. A loaned player (staff
// `loan`) shows an OUT/IN badge instead of any transfer action: the server rejects
// every mutation on a loaned player (PLAYER_ON_LOAN).

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useOwnedClubs } from "./club-context";
import { PlayerCardView } from "./player-card-view";
import { SellPlayerDialog, CreateAuctionDialog, ReleaseClauseDialog, SignFreeAgentDialog, LoanPlayerDialog, ClauseEditDialog } from "./action-dialogs";
import type { PlayerProfileResponse, PlayerCardData } from "./types";

export function PlayerProfileDialog({
  playerId, open, onOpenChange,
}: {
  playerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { ownedClubs, managedClubs } = useOwnedClubs();
  const [sellOpen, setSellOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const [clauseOpen, setClauseOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [clauseEditOpen, setClauseEditOpen] = useState(false);

  const profile = useQuery({
    queryKey: ["markets", "player", playerId],
    queryFn: () => apiFetch<PlayerProfileResponse>(`/api/players/${playerId}`),
    enabled: open && !!playerId,
  });

  const data = profile.data;
  const isStaff = data?.view === "STAFF";
  const staff = isStaff ? data.player : null;
  const name = data
    ? isStaff
      ? `${staff!.firstName} ${staff!.lastName}`
      : `${data.player.firstName} ${data.player.lastName}`
    : "…";

  // Own-club = a club the user OWNS or MANAGES (manager runs the transfer desk too).
  const actingIds = new Set([...ownedClubs, ...managedClubs].map((c) => c.id));
  const clubId = staff?.clubId ?? null;
  const isOwnClubPlayer = !!clubId && actingIds.has(clubId);
  const isFreeAgent = isStaff ? staff!.state.isFreeAgent : false;
  const staffLoan = isStaff ? staff!.loan ?? null : null;
  const hasLoan = !!staffLoan;
  // OUT = my player is away at the borrowing club (origin is one of my clubs);
  // IN = a player borrowed from another club and registered at one of mine.
  const loanOut = !!staffLoan?.originClubId && actingIds.has(staffLoan.originClubId);
  const card: PlayerCardData | null = data
    ? isStaff
      ? { id: staff!.id, name, position: staff!.position, ovr: staff!.ovr, stars: staff!.stars, age: staff!.age, marketValue: staff!.marketValue }
      : { id: data.player.id, name, position: data.player.position, ovr: data.player.ovr, stars: data.player.stars, age: data.player.age, marketValue: 0 }
    : null;

  // Task 9-a: a loaned player cannot be sold, listed, loaned again or re-claused —
  // every server mutation returns PLAYER_ON_LOAN. Surface state instead of actions.
  const canSellOrAuction = isOwnClubPlayer && !hasLoan; // server enforces OWNER or MANAGER; UI hints via acting clubs
  const canExercise = !!clubId && !isOwnClubPlayer && !hasLoan;
  const canSign = isFreeAgent;
  const clauseCost = isStaff ? (staff!.releaseClause > 0 ? staff!.releaseClause : staff!.marketValue * 5) : null;

  const closeAll = (v: boolean) => {
    onOpenChange(v);
    if (!v) {
      setSellOpen(false);
      setAuctionOpen(false);
      setClauseOpen(false);
      setSignOpen(false);
      setLoanOpen(false);
      setClauseEditOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeAll}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" role="dialog" aria-label={t("markets.profile.title")}>
          <DialogHeader>
            <DialogTitle>{t("markets.profile.title")}</DialogTitle>
            <DialogDescription>
              {profile.isLoading ? t("markets.state.loading") : isStaff ? t("markets.profile.staffView") : t("markets.profile.publicView")}
            </DialogDescription>
          </DialogHeader>

          {profile.isLoading || !card ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <PlayerCardView player={card} />
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <ProfileField label={t("markets.player.value")} value={isStaff ? formatCurrency(staff!.marketValue) : t("common.unavailable")} />
                  {isStaff && <ProfileField label={t("markets.player.potential")} value={String(staff!.potential)} />}
                  {isStaff && <ProfileField label={t("common.salary")} value={`${formatCurrency(staff!.salary)} / ${t("common.day").toLowerCase()}`} />}
                  {isStaff && (
                    <ProfileField
                      label={t("common.releaseClause")}
                      value={staff!.releaseClause > 0 ? formatCurrency(staff!.releaseClause) : formatCurrency(staff!.marketValue * 5)}
                    />
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isFreeAgent && (
                    <Badge className="border border-sky-500/30 bg-sky-500/15 text-sky-300">{t("markets.profile.freeAgent")}</Badge>
                  )}
                </div>
              </div>

              {isStaff && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <ProfileField label={t("player.form")} value={String(staff!.state.form)} inline />
                    <ProfileField label={t("player.sharpness")} value={String(staff!.state.sharpness)} inline />
                    <ProfileField label={t("player.fatigue")} value={String(staff!.state.fatigue)} inline />
                    <ProfileField label={t("player.morale")} value={String(staff!.state.morale)} inline />
                    <ProfileField label={t("player.confidence")} value={String(staff!.state.confidence)} inline />
                    <ProfileField
                      label={t("player.suspended")}
                      value={staff!.state.suspension > 0 ? String(staff!.state.suspension) : "—"}
                      inline
                    />
                  </div>
                  {staff!.state.injuredUntil && (
                    <p className="text-xs text-destructive">
                      {t("player.injured")}: {formatDate(staff!.state.injuredUntil)}
                    </p>
                  )}
                </>
              )}

              <Separator />

              <div className="flex flex-col gap-2">
                {staffLoan ? (
                  <Badge
                    className={
                      loanOut
                        ? "w-fit border border-amber-500/30 bg-amber-500/15 text-amber-300"
                        : "w-fit border border-sky-500/30 bg-sky-500/15 text-sky-300"
                    }
                  >
                    {loanOut
                      ? t("markets.profile.loanOutBadge", { day: staffLoan.untilDay })
                      : t("markets.profile.loanInBadge", { day: staffLoan.untilDay })}
                  </Badge>
                ) : (
                  <>
                    {canSellOrAuction && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="min-h-11" aria-label={t("markets.profile.sellAction")} onClick={() => setSellOpen(true)}>
                          {t("markets.profile.sellAction")}
                        </Button>
                        <Button variant="outline" className="min-h-11" aria-label={t("markets.profile.auctionAction")} onClick={() => setAuctionOpen(true)}>
                          {t("markets.profile.auctionAction")}
                        </Button>
                        <Button variant="outline" className="min-h-11" aria-label={t("markets.profile.loanAction")} onClick={() => setLoanOpen(true)}>
                          {t("markets.profile.loanAction")}
                        </Button>
                        <Button variant="outline" className="min-h-11" aria-label={t("markets.profile.clauseEditAction")} onClick={() => setClauseEditOpen(true)}>
                          {t("markets.profile.clauseEditAction")}
                        </Button>
                      </div>
                    )}
                    {canExercise && (
                      <Button variant="destructive" className="min-h-11" onClick={() => setClauseOpen(true)}>
                        {t("markets.profile.clauseAction")}
                      </Button>
                    )}
                    {canSign && (
                      <Button
                        className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setSignOpen(true)}
                      >
                        {t("markets.profile.signAction")}
                      </Button>
                    )}
                    {!canSellOrAuction && !canExercise && !canSign && (
                      <p className="text-sm text-muted-foreground">{t("markets.profile.noActions")}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested action flows reuse the shared dialogs */}
      <SellPlayerDialog open={sellOpen} onOpenChange={setSellOpen} initialPlayerId={playerId} />
      <CreateAuctionDialog open={auctionOpen} onOpenChange={setAuctionOpen} initialPlayerId={playerId} />
      <ReleaseClauseDialog
        open={clauseOpen}
        onOpenChange={setClauseOpen}
        playerId={playerId}
        playerName={name}
        knownCost={clauseCost}
      />
      <SignFreeAgentDialog open={signOpen} onOpenChange={setSignOpen} playerId={playerId} playerName={name} fee={isStaff ? staff!.marketValue : 0} />
      {/* Task 9-a: loan-out + clause-edit flows (own-club players only) */}
      <LoanPlayerDialog open={loanOpen} onOpenChange={setLoanOpen} initialPlayerId={playerId} playerName={name} />
      <ClauseEditDialog
        open={clauseEditOpen}
        onOpenChange={setClauseEditOpen}
        playerId={playerId}
        playerName={name}
        currentValue={isStaff ? staff!.releaseClause : 0}
        marketValue={isStaff ? staff!.marketValue : 0}
      />
    </>
  );
}

function ProfileField({ label, value, inline }: { label: string; value: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-2.5 py-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
