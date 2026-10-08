"use client";
// Knight FM — Managers market tab (Task 4-c). Open contract offers with the full
// §14 breakdown (seasons + total + duration + derived daily salary), apply flow with
// the active-contract rule explained, and owner offer creation with live salary preview.

import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, RefreshCw } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch, useAuth } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { useMarketError, useAutoSelection, useOwnedClubs } from "../club-context";
import { ClubPickList } from "../player-card-view";
import type { ClubLite, ManagerOfferItem } from "../types";

export function ManagersTab({ club }: { club: ClubLite }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const { user } = useAuth();
  const { ownedClubs } = useOwnedClubs();
  const [applyTarget, setApplyTarget] = useState<ManagerOfferItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const offers = useQuery({
    queryKey: ["markets", "manager-offers"],
    queryFn: () => apiFetch<{ items: ManagerOfferItem[] }>("/api/markets/manager-offers"),
    refetchInterval: 60_000,
  });

  const isManager = user?.path === "MANAGER";
  const isOwner = ownedClubs.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Alert className="flex-1 border-border bg-muted/40 py-2">
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs">{t("markets.managers.myOffersNote")}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11" onClick={() => offers.refetch()} aria-label={t("markets.action.refresh")}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
            disabled={!isOwner}
            title={!isOwner ? t("markets.err.notClubOwner") : undefined}
          >
            {t("markets.managers.createTitle")}
          </Button>
        </div>
      </div>

      {offers.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-xl" />
          ))}
        </div>
      ) : offers.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => offers.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (offers.data?.items.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.managers.empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.data!.items.map((o) => (
            <Card key={o.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{o.club.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t(o.club.regionNameKey)}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 border-primary/40 bg-primary/10 text-primary">
                    {t("markets.state.open")}
                  </Badge>
                </div>

                {/* Full §14 breakdown: seasons, total, real duration, derived daily salary */}
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">{t("markets.managers.seasons")}</dt>
                    <dd className="font-semibold">{o.seasons}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">{t("markets.managers.totalAmount")}</dt>
                    <dd className="font-semibold text-primary">{formatCurrency(o.contract.totalAmount)}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">{t("markets.managers.durationDays")}</dt>
                    <dd className="font-semibold">{o.contract.durationDays} {t("common.days")}</dd>
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <dt className="text-xs text-muted-foreground">{t("markets.managers.dailySalary")}</dt>
                    <dd className="font-semibold text-primary">{formatCurrency(o.contract.dailySalary)}/d</dd>
                  </div>
                </dl>

                <p className="text-xs text-muted-foreground">
                  {t("markets.managers.expires")}: {formatDate(o.expiresAt, { dateStyle: "short", timeStyle: "short" })}
                </p>

                <Button
                  className="mt-auto min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setApplyTarget(o)}
                >
                  {t("markets.action.apply")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Apply confirmation — explains the direct-replacement / active-contract rule */}
      <AlertDialog open={!!applyTarget} onOpenChange={(v) => !v && setApplyTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("markets.managers.applyTitle", { club: applyTarget?.club.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {applyTarget &&
                t("markets.managers.applyDesc", {
                  days: applyTarget.contract.durationDays,
                  total: applyTarget.contract.totalAmount,
                  daily: applyTarget.contract.dailySalary,
                })}
              {!isManager && ` ${t("markets.err.managerPathRequired")}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <ApplyButton offer={applyTarget} onDone={() => setApplyTarget(null)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreateOfferDialog open={createOpen} onOpenChange={setCreateOpen} preferredClubId={club.role === "OWNER" ? club.id : null} />
    </div>
  );
}

function ApplyButton({ offer, onDone }: { offer: ManagerOfferItem | null; onDone: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();

  const apply = useMutation({
    mutationFn: () => apiFetch(`/api/markets/manager-offers/${offer!.id}/apply`, { method: "POST" }),
    onSuccess: () => {
      toast({ description: t("markets.managers.applySuccess") });
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
    <AlertDialogAction
      className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
      disabled={apply.isPending}
      onClick={(e) => {
        e.preventDefault();
        apply.mutate();
      }}
    >
      {apply.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {t("common.confirm")}
    </AlertDialogAction>
  );
}

function CreateOfferDialog({
  open, onOpenChange, preferredClubId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preferredClubId: string | null;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();
  const { ownedClubs, isLoading: clubsLoading } = useOwnedClubs();

  const session = open ? `offer:${preferredClubId ?? "none"}:${ownedClubs.map((c) => c.id).join("+")}` : "closed";
  const autoClub = preferredClubId ?? (ownedClubs.length === 1 ? ownedClubs[0].id : null);
  const [clubId, setClubId] = useAutoSelection<string | null>(autoClub, session);
  const [seasons, setSeasons] = useState<"1" | "2" | "3">("1");
  const [total, setTotal] = useState("");

  const seasonsNum = Number(seasons);
  const durationDays = seasonsNum * 37;
  const totalNum = Math.floor(Number(total));
  const dailySalary = Number.isFinite(totalNum) && totalNum > 0 ? Math.floor(totalNum / durationDays) : 0;
  const canSubmit = !!clubId && Number.isFinite(totalNum) && totalNum >= durationDays;

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/manager-offers", {
        method: "POST",
        body: { clubId, seasons: seasonsNum, totalAmount: totalNum },
      }),
    onSuccess: () => {
      toast({ description: t("markets.state.done") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      onOpenChange(false);
      setTotal("");
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

  const clubOptions = useMemo(() => ownedClubs.map((c) => ({ id: c.id, name: c.name })), [ownedClubs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md" role="dialog" aria-label={t("markets.managers.createTitle")}>
        <DialogHeader>
          <DialogTitle>{t("markets.managers.createTitle")}</DialogTitle>
          <DialogDescription>{t("markets.managers.createDesc")}</DialogDescription>
        </DialogHeader>

        {clubsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="space-y-4">
            {clubOptions.length === 0 ? (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertDescription>{t("markets.err.notClubOwner")}</AlertDescription>
              </Alert>
            ) : (
              <>
                {clubOptions.length > 1 && (
                  <div className="space-y-2">
                    <Label id="offer-club-label">{t("markets.managers.chooseClub")}</Label>
                    <ClubPickList clubs={clubOptions} value={clubId} onChange={setClubId} labelId="offer-club-label" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("markets.managers.seasonsLabel")}</Label>
                  <Select value={seasons} onValueChange={(v) => setSeasons(v as "1" | "2" | "3")}>
                    <SelectTrigger className="min-h-11 w-full" aria-label={t("markets.managers.seasonsLabel")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 {t("common.season").toLowerCase()}</SelectItem>
                      <SelectItem value="2">2 {t("common.seasons")}</SelectItem>
                      <SelectItem value="3">3 {t("common.seasons")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-total">{t("markets.managers.totalLabel")}</Label>
                  <Input
                    id="offer-total"
                    type="number"
                    min={durationDays}
                    inputMode="numeric"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    aria-describedby="offer-total-hint"
                  />
                  <p id="offer-total-hint" className="text-xs text-muted-foreground">
                    {t("markets.err.offerTooLow", { min: durationDays })}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-sm font-semibold text-primary">
                    {t("markets.managers.salaryPreview", { daily: formatCurrency(dailySalary) })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("markets.managers.salaryCaption")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("markets.managers.durationDays")}: {durationDays} {t("common.days")}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!canSubmit || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.action.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
