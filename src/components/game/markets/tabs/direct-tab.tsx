"use client";
// Knight FM — Direct market tab (Task 4-c). Public listing grid with filters +
// owner "list for sale" flow + buyer confirm dialog. Server errors surface honestly.

import React, { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, RefreshCw, Search, Tag } from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { PlayerCardView } from "../player-card-view";
import { DirectBuyDialog, SellPlayerDialog } from "../action-dialogs";
import { PlayerProfileDialog } from "../player-profile-dialog";
import type { ClubLite, DirectListing, Paginated } from "../types";

const MAX_SLIDER = 20000;

export function DirectTab({ club }: { club: ClubLite }) {
  const { t, formatCurrency, formatDate } = useI18n();
  const [position, setPosition] = useState<string>("all");
  const [maxValue, setMaxValue] = useState<number[]>([MAX_SLIDER]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [sellOpen, setSellOpen] = useState(false);
  const [buyTarget, setBuyTarget] = useState<DirectListing | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const listings = useQuery({
    queryKey: ["markets", "direct", page, position, maxValue[0]],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (position !== "all") params.set("position", position);
      if (maxValue[0] < MAX_SLIDER) params.set("maxValue", String(maxValue[0]));
      return apiFetch<Paginated<DirectListing>>(`/api/markets/direct?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  // Client-side name filter (honest: filters the current page only — API has no q param).
  const items = (listings.data?.items ?? []).filter((l) =>
    (l.player?.name ?? "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const isOwnListing = (l: DirectListing) => club.role === "OWNER" && l.sellerClub?.id === club.id;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="direct-position">{t("markets.filters.position")}</Label>
              <Select
                value={position}
                onValueChange={(v) => {
                  setPosition(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="direct-position" className="min-h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="GK">{t("pos.GK")}</SelectItem>
                  <SelectItem value="DF">{t("pos.DF")}</SelectItem>
                  <SelectItem value="MF">{t("pos.MF")}</SelectItem>
                  <SelectItem value="FW">{t("pos.FW")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="direct-search">{t("markets.filters.search")}</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="direct-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                  placeholder={t("common.search")}
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="direct-maxvalue">
                {t("markets.filters.maxValue")}: {maxValue[0] >= MAX_SLIDER ? t("markets.filters.anyValue") : formatCurrency(maxValue[0])}
              </Label>
              <Slider
                min={0}
                max={MAX_SLIDER}
                step={100}
                value={maxValue}
                onValueChange={(v) => {
                  setMaxValue(v);
                  setPage(1);
                }}
                aria-label={t("markets.filters.maxValue")}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => listings.refetch()}
              aria-label={t("markets.action.refresh")}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setSellOpen(true)}
              disabled={club.role !== "OWNER"}
              title={club.role !== "OWNER" ? t("markets.err.notClubOwner") : undefined}
            >
              <Tag className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("markets.list")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {listings.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : listings.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => listings.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.direct.empty")}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((l) => {
              const own = isOwnListing(l);
              return (
                <Card key={l.listingId} className="flex flex-col">
                  <CardContent className="flex flex-1 flex-col gap-3 p-4">
                    {l.player ? (
                      <button
                        type="button"
                        onClick={() => setProfileId(l.player!.id)}
                        className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={t("markets.action.viewProfile")}
                      >
                        <PlayerCardView player={l.player} />
                      </button>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )}
                    <div className="mt-auto space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted-foreground">{t("markets.price")}</span>
                        <span className="text-base font-bold text-primary">{formatCurrency(l.price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{t("markets.seller")}: {l.sellerClub?.name ?? "—"}</span>
                        <span className="shrink-0">{formatDate(l.createdAt, { dateStyle: "short" })}</span>
                      </div>
                      <Button
                        className="min-h-11 w-full"
                        disabled={own}
                        variant={own ? "secondary" : "default"}
                        onClick={() => setBuyTarget(l)}
                      >
                        {own ? t("markets.direct.ownListing") : t("markets.buy")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Pagination page={listings.data?.page ?? 1} pages={listings.data?.pages ?? 1} onPage={setPage} />
        </>
      )}

      <SellPlayerDialog open={sellOpen} onOpenChange={setSellOpen} />
      <DirectBuyDialog
        open={!!buyTarget}
        onOpenChange={(v) => !v && setBuyTarget(null)}
        listingId={buyTarget?.listingId ?? null}
        playerName={buyTarget?.player?.name ?? "—"}
        price={buyTarget?.price ?? 0}
        sellerClubId={buyTarget?.sellerClub?.id ?? null}
      />
      <PlayerProfileDialog playerId={profileId} open={!!profileId} onOpenChange={(v) => !v && setProfileId(null)} />
    </div>
  );
}

export function Pagination({
  page, pages, onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  const { t } = useI18n();
  return (
    <nav className="flex items-center justify-center gap-3" aria-label={t("markets.state.page", { page, pages })}>
      <Button variant="outline" size="sm" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        {t("markets.state.prev")}
      </Button>
      <span className="text-sm text-muted-foreground">{t("markets.state.page", { page, pages })}</span>
      <Button variant="outline" size="sm" className="min-h-11" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t("markets.state.next")}
        <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
