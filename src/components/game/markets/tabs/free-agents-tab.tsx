"use client";
// Knight FM — Free agents tab (Task 4-c). Public grid with position/OVR filters,
// sign flow (fee = market value, club treasury) with capacity errors surfaced honestly.

import React, { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RefreshCw, UserPlus } from "lucide-react";
import { apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";
import { PlayerCardView } from "../player-card-view";
import { SignFreeAgentDialog } from "../action-dialogs";
import { PlayerProfileDialog } from "../player-profile-dialog";
import { Pagination } from "./direct-tab";
import type { Paginated, PlayerCardData } from "../types";

export function FreeAgentsTab() {
  const { t, formatCurrency } = useI18n();
  const [position, setPosition] = useState<string>("all");
  const [ovrRange, setOvrRange] = useState<number[]>([0, 99]);
  const [page, setPage] = useState(1);
  const [signTarget, setSignTarget] = useState<PlayerCardData | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ["markets", "free-agents", page, position, ovrRange[0], ovrRange[1]],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page) });
      if (position !== "all") params.set("position", position);
      if (ovrRange[0] > 0) params.set("minOvr", String(ovrRange[0]));
      if (ovrRange[1] < 99) params.set("maxOvr", String(ovrRange[1]));
      return apiFetch<Paginated<PlayerCardData>>(`/api/markets/free-agents?${params.toString()}`);
    },
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fa-position">{t("markets.filters.position")}</Label>
              <Select
                value={position}
                onValueChange={(v) => {
                  setPosition(v);
                  setPage(1);
                }}
              >
                <SelectTrigger id="fa-position" className="min-h-11 w-full">
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
              <Label>
                {t("markets.filters.minOvr")} / {t("markets.filters.maxOvr")}: {ovrRange[0]}–{ovrRange[1]}
              </Label>
              <Slider
                min={0}
                max={99}
                step={1}
                value={ovrRange}
                onValueChange={(v) => {
                  setOvrRange(v);
                  setPage(1);
                }}
                aria-label={`${t("markets.filters.minOvr")} ${t("markets.filters.maxOvr")}`}
                className="mt-3"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" className="min-h-11" onClick={() => agents.refetch()} aria-label={t("markets.action.refresh")}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {agents.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : agents.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">{t("markets.err.loadFailed")}</p>
            <Button variant="outline" className="min-h-11" onClick={() => agents.refetch()}>
              {t("markets.action.retry")}
            </Button>
          </CardContent>
        </Card>
      ) : (agents.data?.items.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t("markets.freeAgents.empty")}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {agents.data!.items.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => setProfileId(p.id)}
                    className="rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("markets.action.viewProfile")}
                  >
                    <PlayerCardView player={p} />
                  </button>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">{t("markets.player.fee")}</span>
                      <span className="text-base font-bold text-primary">{formatCurrency(p.marketValue)}</span>
                    </div>
                    <Button
                      className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => setSignTarget(p)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t("markets.action.sign")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={agents.data!.page} pages={agents.data!.pages} onPage={setPage} />
        </>
      )}

      <SignFreeAgentDialog
        open={!!signTarget}
        onOpenChange={(v) => !v && setSignTarget(null)}
        playerId={signTarget?.id ?? null}
        playerName={signTarget?.name ?? "—"}
        fee={signTarget?.marketValue ?? 0}
      />
      <PlayerProfileDialog playerId={profileId} open={!!profileId} onOpenChange={(v) => !v && setProfileId(null)} />
    </div>
  );
}
