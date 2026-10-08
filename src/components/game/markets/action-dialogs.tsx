"use client";
// Knight FM — shared market action dialogs (Task 4-c + 9-a).
// SellPlayerDialog · CreateAuctionDialog · SignFreeAgentDialog · ReleaseClauseDialog ·
// DirectBuyDialog · LoanPlayerDialog · ClauseEditDialog. All flows resolve the acting
// owned club: auto when one club, selector when several, honest "club required" when
// none. Server errors surface honestly.
// Selections use useAutoSelection (effect-free): reopening a dialog for another target
// falls back to the auto value.

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarClock, Loader2, Search, ShieldAlert } from "lucide-react";
import { ApiError, apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useAutoSelection, useMarketError, useOwnedClubs, OwnedClub } from "./club-context";
import { ClubPickList, PlayerCardView } from "./player-card-view";
import type { SquadPlayer } from "./types";

function NoClubNotice() {
  const { t } = useI18n();
  return (
    <Alert className="border-amber-500/40 bg-amber-500/10">
      <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden="true" />
      <AlertDescription>{t("markets.err.clubRequired")}</AlertDescription>
    </Alert>
  );
}

function ClubStep({
  clubs, clubId, onPick, label,
}: {
  clubs: OwnedClub[];
  clubId: string | null;
  onPick: (id: string) => void;
  label: string;
}) {
  const { t } = useI18n();
  if (clubs.length <= 1) return null;
  return (
    <div className="space-y-2">
      <Label id="acting-club-label">{label}</Label>
      <ClubPickList clubs={clubs} value={clubId} onChange={onPick} labelId="acting-club-label" />
      {!clubId && <p className="text-xs text-muted-foreground">{t("markets.direct.chooseClub")}</p>}
    </div>
  );
}

// ─── Squad picker (shared by sell + auction dialogs) ──────────────

function SquadPicker({
  clubId, enabled, selectedId, onPick, withSearch,
}: {
  clubId: string | null;
  enabled: boolean;
  selectedId: string | null;
  onPick: (id: string) => void;
  withSearch: boolean;
}) {
  const { t, formatCurrency } = useI18n();
  const [search, setSearch] = useState("");

  const squad = useQuery({
    queryKey: ["markets", "squad", clubId],
    queryFn: () => apiFetch<{ players: SquadPlayer[] }>(`/api/players?clubId=${encodeURIComponent(clubId as string)}`),
    enabled: enabled && !!clubId,
  });

  const players = (squad.data?.players ?? []).filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="space-y-2">
      <Label>{t("markets.direct.choosePlayer")}</Label>
      {withSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("markets.direct.squadSearch")}
            className="pl-8"
            aria-label={t("markets.direct.squadSearch")}
          />
        </div>
      )}
      <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
        {squad.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : players.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{t("markets.state.emptySquad")}</p>
        ) : (
          players.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              aria-pressed={selectedId === p.id}
              className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selectedId === p.id ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-muted/60"
              }`}
            >
              <PlayerCardView
                player={{ id: p.id, name: `${p.firstName} ${p.lastName}`, position: p.position, ovr: p.ovr, stars: p.stars, age: p.age, marketValue: p.marketValue }}
                className="min-w-0 flex-1"
              />
              <span className="shrink-0 text-xs text-muted-foreground">{formatCurrency(p.marketValue)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── SellPlayerDialog ─────────────────────────────────────────────

export function SellPlayerDialog({
  open, onOpenChange, initialPlayerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPlayerId?: string | null;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, managedClubs, isLoading: clubsLoading } = useOwnedClubs();
  // User mandate: the club's MANAGER runs the transfer desk too.
  const actingClubs = React.useMemo(() => [...ownedClubs, ...managedClubs], [ownedClubs, managedClubs]);

  const session = open ? `${initialPlayerId ?? "none"}:${actingClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = actingClubs.length === 1 ? actingClubs[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);
  const [playerId, setPlayerId] = useAutoSelection<string | null>(initialPlayerId ?? null, session);
  const [price, setPrice] = useAutoSelection("", `${session}:${playerId ?? "none"}`);

  const squad = useQuery({
    queryKey: ["markets", "squad", clubId],
    queryFn: () => apiFetch<{ players: SquadPlayer[] }>(`/api/players?clubId=${encodeURIComponent(clubId as string)}`),
    enabled: open && !!clubId,
  });
  const selected = useMemo(
    () => squad.data?.players.find((p) => p.id === playerId) ?? null,
    [squad.data, playerId]
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/direct/list", {
        method: "POST",
        body: { playerId, price: Math.floor(Number(price)) },
      }),
    onSuccess: () => {
      toast({ description: t("markets.direct.listSuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      onOpenChange(false);
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

  const priceNum = Math.floor(Number(price));
  const canSubmit = !!clubId && !!playerId && Number.isFinite(priceNum) && priceNum > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" role="dialog" aria-label={t("markets.direct.sellTitle")}>
        <DialogHeader>
          <DialogTitle>{t("markets.direct.sellTitle")}</DialogTitle>
          <DialogDescription>{t("markets.direct.sellDesc")}</DialogDescription>
        </DialogHeader>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : actingClubs.length === 0 ? (
          <NoClubNotice />
        ) : (
          <div className="space-y-4">
            <ClubStep clubs={actingClubs} clubId={clubId} onPick={setClubId} label={t("markets.direct.chooseClub")} />

            {clubId && (
              <SquadPicker
                clubId={clubId}
                enabled={open}
                selectedId={playerId}
                onPick={setPlayerId}
                withSearch={!initialPlayerId}
              />
            )}

            {selected && (
              <div className="space-y-2">
                <Label htmlFor="direct-price">{t("markets.direct.priceLabel")}</Label>
                <Input
                  id="direct-price"
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={String(selected.marketValue)}
                  aria-describedby="direct-price-hint"
                />
                <p id="direct-price-hint" className="text-xs text-muted-foreground">
                  {t("markets.direct.priceHintDefault")}
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.list")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CreateAuctionDialog ──────────────────────────────────────────

export function CreateAuctionDialog({
  open, onOpenChange, initialPlayerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPlayerId?: string | null;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, managedClubs, isLoading: clubsLoading } = useOwnedClubs();
  // User mandate: the club's MANAGER runs the transfer desk too.
  const actingClubs = useMemo(() => [...ownedClubs, ...managedClubs], [ownedClubs, managedClubs]);

  const session = open ? `${initialPlayerId ?? "none"}:${actingClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = actingClubs.length === 1 ? actingClubs[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);
  const [playerId, setPlayerId] = useAutoSelection<string | null>(initialPlayerId ?? null, session);
  const [startPrice, setStartPrice] = useAutoSelection("", `${session}:${playerId ?? "none"}`);
  const [hours, setHours] = useState<"24" | "48" | "72">("24");

  const squad = useQuery({
    queryKey: ["markets", "squad", clubId],
    queryFn: () => apiFetch<{ players: SquadPlayer[] }>(`/api/players?clubId=${encodeURIComponent(clubId as string)}`),
    enabled: open && !!clubId,
  });
  const selected = useMemo(
    () => squad.data?.players.find((p) => p.id === playerId) ?? null,
    [squad.data, playerId]
  );

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/auctions/create", {
        method: "POST",
        body: { playerId, startPrice: Math.floor(Number(startPrice)), hours: Number(hours) },
      }),
    onSuccess: () => {
      toast({ description: t("markets.auctions.createSuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      onOpenChange(false);
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

  const priceNum = Math.floor(Number(startPrice));
  const canSubmit = !!clubId && !!playerId && Number.isFinite(priceNum) && priceNum > 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" role="dialog" aria-label={t("markets.auctions.createTitle")}>
        <DialogHeader>
          <DialogTitle>{t("markets.auctions.createTitle")}</DialogTitle>
          <DialogDescription>{t("markets.auctions.createDesc")}</DialogDescription>
        </DialogHeader>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : actingClubs.length === 0 ? (
          <NoClubNotice />
        ) : (
          <div className="space-y-4">
            <ClubStep clubs={actingClubs} clubId={clubId} onPick={setClubId} label={t("markets.direct.chooseClub")} />

            {clubId && (
              <SquadPicker
                clubId={clubId}
                enabled={open}
                selectedId={playerId}
                onPick={setPlayerId}
                withSearch={!initialPlayerId}
              />
            )}

            {selected && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="auction-start">{t("markets.auctions.startPriceLabel")}</Label>
                  <Input
                    id="auction-start"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={startPrice}
                    onChange={(e) => setStartPrice(e.target.value)}
                    placeholder={String(Math.ceil(selected.marketValue * 0.2))}
                    aria-describedby="auction-start-hint"
                  />
                  <p id="auction-start-hint" className="text-xs text-muted-foreground">
                    {t("markets.auctions.startPriceHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>{t("markets.auctions.duration")}</Label>
                  <Select value={hours} onValueChange={(v) => setHours(v as "24" | "48" | "72")}>
                    <SelectTrigger className="min-h-11 w-full" aria-label={t("markets.auctions.duration")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">{t("markets.auctions.duration24")}</SelectItem>
                      <SelectItem value="48">{t("markets.auctions.duration48")}</SelectItem>
                      <SelectItem value="72">{t("markets.auctions.duration72")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.action.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── SignFreeAgentDialog ──────────────────────────────────────────

export function SignFreeAgentDialog({
  open, onOpenChange, playerId, playerName, fee,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playerId: string | null;
  playerName: string;
  fee: number;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const session = open ? `${playerId ?? "none"}:${ownedClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = ownedClubs.length === 1 ? ownedClubs[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/markets/free-agents/${playerId}/sign`, {
        method: "POST",
        body: { clubId: clubId ?? undefined },
      }),
    onSuccess: () => {
      toast({ description: t("markets.freeAgents.signSuccess", { player: playerName }) });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      onOpenChange(false);
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

  const canSubmit = !!clubId && !!playerId && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.freeAgents.signTitle", { player: playerName })}>
        <DialogHeader>
          <DialogTitle>{t("markets.freeAgents.signTitle", { player: playerName })}</DialogTitle>
          <DialogDescription>{t("markets.freeAgents.signDesc", { fee: formatCurrency(fee) })}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{playerName}</p>
          <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(fee)}</p>
        </div>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : ownedClubs.length === 0 ? (
          <NoClubNotice />
        ) : (
          <ClubStep clubs={ownedClubs} clubId={clubId} onPick={setClubId} label={t("markets.direct.buyer")} />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.action.sign")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ReleaseClauseDialog ──────────────────────────────────────────

export function ReleaseClauseDialog({
  open, onOpenChange, playerId, playerName, knownCost,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playerId: string | null;
  playerName: string;
  /** Exact cost when the caller knows it (staff view); null → honest unknown note. */
  knownCost?: number | null;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const session = open ? `${playerId ?? "none"}:${ownedClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = ownedClubs.length === 1 ? ownedClubs[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/release-clause", {
        method: "POST",
        body: { playerId, clubId: clubId ?? undefined },
      }),
    onSuccess: () => {
      toast({ description: t("markets.release.success", { player: playerName }) });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      onOpenChange(false);
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

  const canSubmit = !!clubId && !!playerId && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.release.confirmTitle", { player: playerName })}>
        <DialogHeader>
          <DialogTitle>{t("markets.release.confirmTitle", { player: playerName })}</DialogTitle>
          <DialogDescription>
            {typeof knownCost === "number"
              ? t("markets.release.confirmDesc", { cost: formatCurrency(knownCost) })
              : t("markets.release.costUnknown")}
          </DialogDescription>
        </DialogHeader>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : ownedClubs.length === 0 ? (
          <NoClubNotice />
        ) : (
          <ClubStep clubs={ownedClubs} clubId={clubId} onPick={setClubId} label={t("markets.direct.chooseClub")} />
        )}

        {typeof knownCost === "number" && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("markets.release.costKnown")}</p>
            <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(knownCost)}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.action.exercise")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── DirectBuyDialog ──────────────────────────────────────────────

export function DirectBuyDialog({
  open, onOpenChange, listingId, playerName, price, sellerClubId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listingId: string | null;
  playerName: string;
  price: number;
  sellerClubId: string | null;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const candidates = useMemo(
    () => ownedClubs.filter((c) => c.id !== sellerClubId),
    [ownedClubs, sellerClubId]
  );
  const session = open ? `${listingId ?? "none"}:${candidates.map((c) => c.id).join("+")}` : "closed";
  const autoClub = candidates.length === 1 ? candidates[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/markets/direct/${listingId}/buy`, {
        method: "POST",
        body: { clubId: clubId ?? undefined },
      }),
    onSuccess: () => {
      toast({ description: t("markets.direct.buySuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["treasury"] });
      onOpenChange(false);
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

  const canSubmit = !!clubId && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.direct.buyTitle")}>
        <DialogHeader>
          <DialogTitle>{t("markets.direct.buyTitle")}</DialogTitle>
          <DialogDescription>{t("markets.direct.buyDesc", { amount: formatCurrency(price) })}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{playerName}</p>
          <p className="mt-1 text-lg font-bold text-primary">{formatCurrency(price)}</p>
        </div>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : candidates.length === 0 ? (
          <NoClubNotice />
        ) : (
          <ClubStep clubs={candidates} clubId={clubId} onPick={setClubId} label={t("markets.direct.buyer")} />
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.buy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── LoanPlayerDialog (Task 9-a) ──────────────────────────────────

/**
 * Lists one of the acting club's players on the LOAN market (POST /api/markets/loan/create).
 * Preselected from the player profile only — there is no squad picker here on purpose:
 * loans always start from a concrete player the owner is looking at.
 * Task 23-f: a loan ALWAYS runs for the rest of the current season — the duration
 * picker is gone; the dialog states the rule instead.
 */
export function LoanPlayerDialog({
  open, onOpenChange, initialPlayerId, playerName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialPlayerId?: string | null;
  playerName?: string;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, managedClubs, isLoading: clubsLoading } = useOwnedClubs();
  // User mandate: the club's MANAGER runs the transfer desk too.
  const actingClubs = React.useMemo(() => [...ownedClubs, ...managedClubs], [ownedClubs, managedClubs]);

  const session = open ? `${initialPlayerId ?? "none"}:${actingClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = actingClubs.length === 1 ? actingClubs[0].id : null;
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);
  const [fee, setFee] = useAutoSelection("0", `${session}:fee`);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/loan/create", {
        method: "POST",
        body: {
          playerId: initialPlayerId,
          price: Math.max(0, Math.floor(Number(fee) || 0)),
        },
      }),
    onSuccess: () => {
      toast({ description: t("markets.loan.createSuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      onOpenChange(false);
    },
    onError: (e) => {
      // The player is registered at the borrowing club — honest, specific message.
      if (e instanceof ApiError && e.code === "PLAYER_ON_LOAN") {
        toast({ variant: "destructive", title: t("game.err.PLAYER_ON_LOAN") });
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

  const feeNum = Math.floor(Number(fee));
  const canSubmit = !!initialPlayerId && !!clubId && Number.isFinite(feeNum) && feeNum >= 0 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" role="dialog" aria-label={t("markets.loan.createTitle")}>
        <DialogHeader>
          <DialogTitle>{t("markets.loan.createTitle")}</DialogTitle>
          <DialogDescription>{t("markets.loan.createDesc")}</DialogDescription>
        </DialogHeader>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : actingClubs.length === 0 ? (
          <NoClubNotice />
        ) : (
          <div className="space-y-4">
            <ClubStep clubs={actingClubs} clubId={clubId} onPick={setClubId} label={t("markets.direct.chooseClub")} />

            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="text-sm font-semibold">{playerName ?? initialPlayerId ?? "…"}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="loan-fee">{t("markets.loan.feeLabel")}</Label>
              <Input
                id="loan-fee"
                type="number"
                min={0}
                inputMode="numeric"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0"
                aria-describedby="loan-fee-hint"
              />
              <p id="loan-fee-hint" className="text-xs text-muted-foreground">{t("markets.loan.freeFeeHint")}</p>
            </div>

            {/* Task 23-f: the duration is no longer choosable — always the rest of the season. */}
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs text-primary">{t("markets.loan.seasonNote")}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.profile.loanAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── ClauseEditDialog (Task 9-a) ──────────────────────────────────

/**
 * Edits an own-club player's release clause (POST /api/players/{id}/clause).
 * The honest minimum (marketValue × 5) is always shown; CLAUSE_TOO_LOW surfaces
 * the server's minValue alongside the localized invariant message.
 */
export function ClauseEditDialog({
  open, onOpenChange, playerId, playerName, currentValue, marketValue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playerId: string | null;
  playerName: string;
  currentValue: number;
  marketValue: number;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();

  const session = open ? `${playerId ?? "none"}:${currentValue}` : "closed";
  const [value, setValue] = useAutoSelection(String(currentValue), session);
  const minValue = marketValue * 5;

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ playerId: string; releaseClause: number; minValue: number }>(
        `/api/players/${encodeURIComponent(playerId ?? "")}/clause`,
        { method: "POST", body: { value: Math.floor(Number(value)) } }
      ),
    onSuccess: (res) => {
      toast({ description: t("markets.clause.success", { value: formatCurrency(res.releaseClause) }) });
      queryClient.invalidateQueries({ queryKey: ["markets", "player", playerId] });
      // Squad rows carry releaseClause — "players" prefix covers qk.players(clubId).
      queryClient.invalidateQueries({ queryKey: ["players"] });
      onOpenChange(false);
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "CLAUSE_TOO_LOW") {
        const min = typeof e.extra?.minValue === "number" ? e.extra.minValue : null;
        toast({
          variant: "destructive",
          title: t("game.err.CLAUSE_TOO_LOW"),
          description: min != null ? t("markets.clause.minHint", { min }) : undefined,
        });
        return;
      }
      if (e instanceof ApiError && e.code === "PLAYER_ON_LOAN") {
        toast({ variant: "destructive", title: t("game.err.PLAYER_ON_LOAN") });
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

  const valueNum = Math.floor(Number(value));
  const canSubmit = !!playerId && Number.isFinite(valueNum) && valueNum >= 1 && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" role="dialog" aria-label={t("markets.clause.title")}>
        <DialogHeader>
          <DialogTitle>{t("markets.clause.title")}</DialogTitle>
          <DialogDescription>{t("markets.clause.desc")}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-sm font-semibold">{playerName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("markets.clause.current")}: <span className="font-semibold text-foreground">{formatCurrency(currentValue)}</span>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="clause-value">{t("markets.clause.newLabel")}</Label>
          <Input
            id="clause-value"
            type="number"
            min={1}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby="clause-min-hint"
          />
          <p id="clause-min-hint" className="text-xs text-muted-foreground">{t("markets.clause.minHint", { min: minValue })}</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="min-h-11">{t("common.cancel")}</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit}
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.clause.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
