"use client";
// Knight FM — Clubs tab (Task 4-c + 3-c + secondary market).
// Three blocks, one tab:
//  1. "Mis clubes en venta" — the session OWNER lists their own clubs on the
//     secondary market with a FREE asking price (POST/DELETE /api/markets/clubs/sale).
//     Money moves only when somebody buys: buyer wallet → seller wallet.
//  2. "Clubes de propietarios" — buyer feed of clubs listed by OTHER owners at their
//     owner-set price (GET /api/markets/clubs/sale → POST …/buy). Division rules do
//     not apply here: resale clubs earned their division on the pitch.
//  3. "Clubes del sistema" — fixed economy.systemClubPrice catalog with the 10-club /
//     1-region / division-gate limits surfaced honestly (GET /api/onboarding/clubs →
//     POST /api/onboarding/purchase-club). MANAGER-path users keep the buy-own note
//     and the resign flow (POST /api/club/resign).

import React, { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, DoorOpen, Info, Loader2, MapPin, Search, Tag, Users } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ApiError, apiFetch, useAuth } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { useToast } from "@/hooks/use-toast";
import { fetchRegions, qk } from "@/components/game/api";
import { useMarketError, useOwnedClubs, type OwnedClub } from "../club-context";
import { Pagination } from "./direct-tab";
import type { OwnerClubListing, SystemClubItem } from "../types";

interface OnboardingClubsResponse {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  price: number | null;
  minDivisionIndex: number;
  clubs: SystemClubItem[];
}

interface OwnerListingsResponse {
  total: number;
  levyPct: number;
  listings: OwnerClubListing[];
}

/** Shared resale-feed query (also carries the configurable income-levy pct for the UI breakdown). */
function useOwnerListingsData() {
  return useQuery({
    queryKey: ["markets", "owner-listings"],
    queryFn: () => apiFetch<OwnerListingsResponse>("/api/markets/clubs/sale"),
    staleTime: 15_000,
  });
}

/** Shared invalidation after any resale mutation (listings + owned clubs + shell cache). */
function useInvalidateClubMarket() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["markets"] });
    queryClient.invalidateQueries({ queryKey: qk.myClubs });
  };
}

export function ClubsTab() {
  const { t, formatCurrency } = useI18n();
  const { user } = useAuth();
  const { ownedClubs, managedClubs } = useOwnedClubs();

  const [q, setQ] = useState("");
  const [regionIndex, setRegionIndex] = useState<string>("all"); // Task 23-c: region filter
  const [page, setPage] = useState(1);
  const [buyTarget, setBuyTarget] = useState<SystemClubItem | null>(null);
  const [resignOpen, setResignOpen] = useState(false);

  // Task 23-c: the region picker (natural, believable region names) keeps the
  // search organized — multi-club owners always know where they are buying.
  const regionsQ = useQuery({ queryKey: qk.regions, queryFn: fetchRegions });

  const clubs = useQuery({
    queryKey: ["markets", "clubs-for-sale", page, q, regionIndex],
    queryFn: () => {
      const params = new URLSearchParams({ path: "OWNER", page: String(page) });
      if (q.trim()) params.set("q", q.trim());
      if (regionIndex !== "all") params.set("regionIndex", regionIndex);
      return apiFetch<OnboardingClubsResponse>(`/api/onboarding/clubs?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
    enabled: user?.path === "OWNER" || !!user, // any authed user can browse; purchase enforces OWNER
  });

  const ownedIds = new Set(ownedClubs.map((c) => c.id));
  const isManagerPath = user?.path === "MANAGER";
  const managedClub = managedClubs[0] ?? null;
  // The seller block makes sense for OWNER-path users and for anyone who already
  // owns clubs (a manager who bought one). Pure managers without clubs skip it.
  const showSellSection = user?.path === "OWNER" || ownedClubs.length > 0;

  return (
    <div className="space-y-4">
      {/* Task 30: honest rule notice — only divisions >= minDivisionIndex are selectable (SYSTEM clubs) */}
      {clubs.data && (
        <Alert className="border-amber-500/30 bg-amber-500/10 py-2">
          <Info className="h-4 w-4 text-amber-300" aria-hidden="true" />
          <AlertDescription className="text-xs text-amber-200">
            {t("markets.clubs.divisionRestrict", { n: clubs.data.minDivisionIndex })}
          </AlertDescription>
        </Alert>
      )}

      {/* MANAGER path: honest note about buying the club they manage (3-c) */}
      {isManagerPath && (
        <Alert className="border-primary/30 bg-primary/10 py-2">
          <Info className="h-4 w-4 text-primary" aria-hidden="true" />
          <AlertDescription className="text-xs text-primary">
            {t("markets.clubs.managerBuyNote")}
          </AlertDescription>
        </Alert>
      )}

      {/* Current managed club — resign flow (3-c) */}
      {managedClub && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t("markets.clubs.myManaged")}</p>
              <p className="truncate text-xs text-muted-foreground">{managedClub.name}</p>
            </div>
            <Button
              variant="outline"
              className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setResignOpen(true)}
            >
              <DoorOpen className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("markets.clubs.resign")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── 1. Mis clubes en venta — owner resale with free pricing ── */}
      {showSellSection && <MySaleListings ownedClubs={ownedClubs} />}

      {/* ── 2. Clubes de propietarios — buyer feed of owner-listed clubs ── */}
      <OwnerListings />

      {/* ── 3. Clubes del sistema — fixed-price catalog ── */}
      <section aria-label={t("markets.clubs.forSale")} className="space-y-4">
        <header>
          <h3 className="text-sm font-semibold tracking-tight">{t("markets.clubs.forSale")}</h3>
          <p className="text-xs text-muted-foreground">{t("markets.clubs.forSaleDesc")}</p>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="clubs-q">{t("common.search")}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="clubs-q"
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  className="pl-8"
                  placeholder={t("common.search")}
                />
              </div>
            </div>
            {/* Task 23-c: region where the club-to-buy is searched. */}
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor="clubs-region">
                <MapPin className="mr-1 inline size-3.5 text-primary" aria-hidden="true" />
                {t("markets.clubs.regionLabel")}
              </Label>
              <Select
                value={regionIndex}
                onValueChange={(v) => {
                  setRegionIndex(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="clubs-region" className="min-h-11 w-full" aria-label={t("markets.clubs.regionLabel")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">{t("markets.clubs.allRegions")}</SelectItem>
                  {(regionsQ.data?.regions ?? []).map((r) => (
                    <SelectItem key={r.id} value={String(r.index)}>
                      {t(r.nameKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {clubs.data?.price != null && (
            <Alert className="sm:w-auto sm:min-w-72 border-primary/30 bg-primary/10 py-2">
              <Info className="h-4 w-4 text-primary" aria-hidden="true" />
              <AlertDescription className="text-xs text-primary">
                {t("markets.clubs.fixedPrice", { price: formatCurrency(clubs.data.price) })}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {clubs.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))}
          </div>
        ) : clubs.isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
              <Button variant="outline" className="min-h-11" onClick={() => clubs.refetch()}>
                {t("markets.action.retry")}
              </Button>
            </CardContent>
          </Card>
        ) : (clubs.data?.clubs.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.clubs.empty")}</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {clubs.data!.clubs.map((c) => {
                const owned = ownedIds.has(c.id);
                const buyOwn = isManagerPath && managedClub?.id === c.id;
                return (
                  <Card key={c.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-sm font-bold text-white"
                          style={{ backgroundColor: c.brand?.primaryColor ?? "#3f3f46" }}
                          aria-hidden="true"
                        >
                          {c.brand?.initials ?? c.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{c.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t(c.regionNameKey)} · {t("markets.clubs.division", { index: c.divisionIndex })}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <span className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
                          <Users className="h-3 w-3" aria-hidden="true" /> {t("markets.clubs.squadSize")}: {c.squadSize}
                        </span>
                        <span className="rounded-md bg-muted/40 px-2 py-1">
                          {t("markets.clubs.avgOvr")}: {c.avgOvr ?? "—"}
                        </span>
                        <span className="rounded-md bg-muted/40 px-2 py-1">
                          {t("markets.clubs.facilities")}: {c.facilitiesCount}
                        </span>
                        <span className="rounded-md bg-muted/40 px-2 py-1">
                          {t("markets.clubs.fund")}: {formatCurrency(c.operatingFund)}
                        </span>
                      </div>

                      <div className="mt-auto space-y-2">
                        <p className="text-center text-base font-bold text-primary">
                          {c.price != null ? formatCurrency(c.price) : "—"}
                        </p>
                        <Button
                          className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={owned}
                          variant={owned ? "secondary" : "default"}
                          onClick={() => setBuyTarget(c)}
                        >
                          <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          {owned ? t("markets.clubs.owned") : buyOwn ? t("markets.clubs.buyOwn") : t("markets.buy")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <Pagination page={clubs.data!.page} pages={clubs.data!.pages} onPage={setPage} />
          </>
        )}
      </section>

      <BuyClubDialog target={buyTarget} price={clubs.data?.price ?? null} onClose={() => setBuyTarget(null)} />

      {/* Resign confirmation — POST /api/club/resign ends the contract as RESIGNED (3-c) */}
      <AlertDialog open={resignOpen} onOpenChange={setResignOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("markets.clubs.resignTitle", { club: managedClub?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("markets.clubs.resignDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <ResignButton club={managedClub} onDone={() => setResignOpen(false)} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── 1. Seller block: list / reprice / withdraw own clubs ──────────

function MySaleListings({ ownedClubs }: { ownedClubs: OwnedClub[] }) {
  const { t } = useI18n();
  const { isLoading } = useOwnedClubs();

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{t("markets.clubs.mySellTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("markets.clubs.mySellDesc")}</p>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : ownedClubs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            {t("markets.clubs.noneOwned")}
          </p>
        ) : (
          <div className="space-y-2">
            {ownedClubs.map((c) => (
              <SellerClubRow key={c.id} club={c} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SellerClubRow({ club }: { club: OwnedClub }) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const invalidate = useInvalidateClubMarket();
  const listingsQ = useOwnerListingsData();
  const levyPct = listingsQ.data?.levyPct ?? 10;

  const [priceInput, setPriceInput] = useState<string>(club.salePrice != null ? String(club.salePrice) : "");

  const trimmed = priceInput.trim();
  const parsed = Number.parseInt(trimmed, 10);
  const validPrice = trimmed !== "" && /^\d+$/.test(trimmed) && Number.isSafeInteger(parsed) && parsed >= 1;
  const listed = club.salePrice != null;
  // Honest net estimate (display only — the server recomputes authoritatively at buy time).
  const estLevy = validPrice ? Math.floor((parsed * levyPct) / 100) : 0;
  const estNet = validPrice ? parsed - estLevy : 0;

  const publish = useMutation({
    mutationFn: () =>
      apiFetch("/api/markets/clubs/sale", {
        method: "POST",
        body: { clubId: club.id, price: parsed },
      }),
    onSuccess: () => {
      toast({ description: t("markets.clubs.publishSuccess") });
      invalidate();
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

  const unlist = useMutation({
    mutationFn: () => apiFetch(`/api/markets/clubs/sale?clubId=${club.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ description: t("markets.clubs.unlistSuccess") });
      setPriceInput("");
      invalidate();
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

  const pending = publish.isPending || unlist.isPending;

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-xs font-bold text-white"
          style={{ backgroundColor: club.brand?.primaryColor ?? "#3f3f46" }}
          aria-hidden="true"
        >
          {club.brand?.initials ?? club.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{club.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {t(club.regionNameKey)} · {t("markets.clubs.division", { index: club.divisionIndex })}
          </p>
        </div>
        {club.salePrice != null ? (
          <Badge className="border-primary/40 bg-primary/10 text-primary" variant="outline">
            <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
            {t("markets.clubs.listedAt", { price: formatCurrency(club.salePrice) })}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-border text-muted-foreground">
            {t("markets.clubs.notListed")}
          </Badge>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`sale-price-${club.id}`} className="text-xs">
            {t("markets.clubs.priceLabel")}
          </Label>
          <Input
            id={`sale-price-${club.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            placeholder={t("markets.clubs.pricePlaceholder")}
            disabled={pending}
            className="min-h-11"
          />
          {validPrice && levyPct > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t("markets.clubs.levyHint", { net: formatCurrency(estNet), pct: levyPct, levy: formatCurrency(estLevy) })}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            className="min-h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none"
            disabled={pending || !validPrice}
            onClick={() => publish.mutate()}
          >
            {publish.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {listed ? t("markets.clubs.updatePrice") : t("markets.clubs.publish")}
          </Button>
          {listed && (
            <Button
              variant="outline"
              className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending}
              onClick={() => unlist.mutate()}
            >
              {unlist.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {t("markets.clubs.unlist")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. Buyer block: clubs listed by other owners ──────────────────

function OwnerListings() {
  const { t, formatCurrency } = useI18n();
  const [buyTarget, setBuyTarget] = useState<OwnerClubListing | null>(null);

  const listings = useOwnerListingsData();

  if (listings.isLoading || listings.isError || (listings.data?.listings.length ?? 0) === 0) {
    // Quiet block: a resale feed with zero offers carries no information beyond
    // the seller card above — hiding it keeps the tab clean.
    return null;
  }

  return (
    <section aria-label={t("markets.clubs.ownerSection")} className="space-y-4">
      <header>
        <h3 className="text-sm font-semibold tracking-tight">{t("markets.clubs.ownerSection")}</h3>
        <p className="text-xs text-muted-foreground">{t("markets.clubs.ownerSectionDesc")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {listings.data!.listings.map((l) => (
          <Card key={l.clubId} className="flex flex-col border-primary/25">
            <CardContent className="flex flex-1 flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-sm font-bold text-white"
                  style={{ backgroundColor: l.brand?.primaryColor ?? "#3f3f46" }}
                  aria-hidden="true"
                >
                  {l.brand?.initials ?? l.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{l.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t(l.regionNameKey)} · {t("markets.clubs.division", { index: l.divisionIndex })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <span className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-1">
                  <Users className="h-3 w-3" aria-hidden="true" /> {t("markets.clubs.squadSize")}: {l.squadSize}
                </span>
                <span className="rounded-md bg-muted/40 px-2 py-1">
                  {t("markets.clubs.avgOvr")}: {l.avgOvr ?? "—"}
                </span>
                <span className="truncate rounded-md bg-muted/40 px-2 py-1">
                  {t("markets.clubs.seller")}: {l.sellerUsername ?? "—"}
                </span>
                <span className="rounded-md bg-muted/40 px-2 py-1">
                  {t("markets.clubs.facilities")}: {l.facilitiesCount}
                </span>
              </div>

              <div className="mt-auto space-y-2">
                <Badge variant="outline" className="w-full justify-center border-primary/40 bg-primary/10 text-primary">
                  <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                  {t("markets.clubs.ownerPriceBadge")}
                </Badge>
                <p className="text-center text-base font-bold text-primary">{formatCurrency(l.salePrice)}</p>
                <Button
                  className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setBuyTarget(l)}
                >
                  <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("markets.buy")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BuyOwnerClubDialog target={buyTarget} levyPct={listings.data?.levyPct ?? 10} onClose={() => setBuyTarget(null)} />
    </section>
  );
}

function BuyOwnerClubDialog({
  target, levyPct, onClose,
}: {
  target: OwnerClubListing | null;
  levyPct: number;
  onClose: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const describeError = useMarketError();
  const invalidate = useInvalidateClubMarket();

  const buy = useMutation({
    mutationFn: () => apiFetch("/api/markets/clubs/sale/buy", { method: "POST", body: { clubId: target!.clubId } }),
    onSuccess: () => {
      toast({ description: t("markets.clubs.buyOwnerSuccess") });
      invalidate();
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "PATH_REQUIRED") {
        toast({ variant: "destructive", title: t("game.err.PATH_REQUIRED") });
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

  // Display-only estimate (the server recomputes authoritatively at buy time).
  const gross = target?.salePrice ?? 0;
  const levy = Math.floor((gross * levyPct) / 100);
  const net = gross - levy;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.clubs.buyTitle", { club: target?.name ?? "" })}>
        <DialogHeader>
          <DialogTitle>{t("markets.clubs.buyTitle", { club: target?.name ?? "—" })}</DialogTitle>
          <DialogDescription>
            {t("markets.clubs.buyOwnerDesc", { price: formatCurrency(gross) })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              {t("markets.clubs.ownerPriceBadge")}
            </Badge>
            {target?.sellerUsername && (
              <span className="text-xs text-muted-foreground">
                {t("markets.clubs.seller")}: {target.sellerUsername}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("markets.clubs.grossRow")}</span>
              <span className="font-semibold">{formatCurrency(gross)}</span>
            </div>
            {levy > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">{t("markets.clubs.levyRow", { pct: levyPct })}</span>
                <span className="text-destructive">−{formatCurrency(levy)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-1.5">
              <span className="font-medium">{t("markets.clubs.sellerNetRow")}</span>
              <span className="font-bold text-primary">{formatCurrency(net)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={buy.isPending}
            onClick={() => buy.mutate()}
          >
            {buy.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.buy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Legacy flows (system purchase + resign) ───────────────────────

function ResignButton({ club, onDone }: { club: { id: string; name: string } | null; onDone: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();

  const resign = useMutation({
    mutationFn: () => apiFetch("/api/club/resign", { method: "POST", body: { clubId: club!.id } }),
    onSuccess: () => {
      toast({ description: t("markets.clubs.resigned", { club: club!.name }) });
      // Refresh markets data (incl. owned/managed clubs) and the shell's club/mine cache.
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: qk.myClubs });
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
      className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
      disabled={resign.isPending || !club}
      onClick={(e) => {
        e.preventDefault();
        resign.mutate();
      }}
    >
      {resign.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {t("markets.clubs.resign")}
    </AlertDialogAction>
  );
}

function BuyClubDialog({
  target, price, onClose,
}: {
  target: SystemClubItem | null;
  price: number | null;
  onClose: () => void;
}) {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const describeError = useMarketError();

  const buy = useMutation({
    mutationFn: () => apiFetch("/api/onboarding/purchase-club", { method: "POST", body: { clubId: target!.id } }),
    onSuccess: () => {
      toast({ description: t("markets.clubs.buySuccess") });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: qk.myClubs });
      onClose();
    },
    onError: (e) => {
      // 3-c: manager buying a club other than the one they currently manage.
      if (e instanceof ApiError && e.code === "RESIGN_REQUIRED") {
        toast({ variant: "destructive", title: t("game.err.RESIGN_REQUIRED") });
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

  const amount = price ?? target?.price ?? 0;

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" role="dialog" aria-label={t("markets.clubs.buyTitle", { club: target?.name ?? "" })}>
        <DialogHeader>
          <DialogTitle>{t("markets.clubs.buyTitle", { club: target?.name ?? "—" })}</DialogTitle>
          <DialogDescription>{t("markets.clubs.buyDesc", { price: formatCurrency(amount) })}</DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            {t("markets.clubs.forSale")}
          </Badge>
          <p className="mt-2 text-lg font-bold text-primary">{formatCurrency(amount)}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" className="min-h-11" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={buy.isPending}
            onClick={() => buy.mutate()}
          >
            {buy.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("markets.buy")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
