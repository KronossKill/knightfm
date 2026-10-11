"use client";
// Knight FM — Club overview (Task 32, section "Club" → sub-tab "Resumen").
// Identity, ownership, division/region, finances, facilities and top players
// in one glanceable screen. Deep info lives one click away (Facilities /
// Finanzas / Plantilla).

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, Shield, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useViewStore } from "@/components/game/view-store";
import { fetchClubProfile, fetchPlayers, qk, type ClubMine } from "@/components/game/api";
import { BrandBadge, EmptyState, ErrorState, KV } from "@/components/game/ui/bits";

export default function ClubOverviewView({ club }: { club: ClubMine }) {
  const { t, formatCurrency } = useI18n();
  const setSection = useViewStore((s) => s.setSection);

  const profileQ = useQuery({
    queryKey: ["club-profile", club.id],
    queryFn: () => fetchClubProfile(club.id),
    staleTime: 60_000,
  });
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });

  const profile = profileQ.data?.club ?? null;
  const players = playersQ.data?.players ?? [];
  const totalValue = players.reduce((a, p) => a + p.marketValue, 0);
  const avgOvr = players.length ? Math.round(players.reduce((a, p) => a + p.ovr, 0) / players.length) : null;
  const topPlayers = (profileQ.data?.topPlayers ?? []).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <BrandBadge brand={club.brand} name={club.name} size="lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold leading-tight">{club.name}</h1>
          <p className="text-sm text-muted-foreground">
            {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto border-brand/40 text-brand-soft">
          {club.role === "OWNER" ? t("role.owner") : t("role.manager")}
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {/* Identity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield aria-hidden="true" className="size-4 text-brand" />
              {t("game.club.overview.identity")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {profileQ.isLoading ? (
              <Skeleton className="h-20 w-full" aria-hidden="true" />
            ) : profileQ.isError ? (
              <ErrorState message={t("err.generic")} onRetry={() => void profileQ.refetch()} className="py-4" />
            ) : (
              <>
                <KV label={t("game.club.overview.owner")}>{profile?.owner?.username ?? t("game.club.overview.system")}</KV>
                <KV label={t("game.club.overview.manager")}>{profile?.manager?.username ?? t("game.club.overview.none")}</KV>
                <KV label={t("game.club.overview.status")}>
                  {profile?.systemOwned ? t("game.club.overview.systemClub") : t("game.club.overview.privately")}
                </KV>
              </>
            )}
          </CardContent>
        </Card>

        {/* Finances */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 aria-hidden="true" className="size-4 text-brand" />
              {t("game.club.overview.finances")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="grid grid-cols-2 gap-3">
              <KV label={t("game.dash.fund")}>{formatCurrency(club.operatingFund)}</KV>
              <KV label={t("game.dash.debt")}>{formatCurrency(club.debt)}</KV>
            </div>
            <KV label={t("game.dash.finState")}>{t(`game.dash.fin.${club.finState}`)}</KV>
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 w-full"
              onClick={() => setSection("club", "finances")}
            >
              {t("game.nav.sub.finances")}
              <ArrowRight aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Squad snapshot */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users aria-hidden="true" className="size-4 text-brand" />
              {t("game.club.overview.squad")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {playersQ.isLoading ? (
              <Skeleton className="h-16 w-full" aria-hidden="true" />
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <KV label={t("game.dash.players")}>{club.playerCount}/{club.capacity.finalCapacity}</KV>
                <KV label={t("game.dash.avgOvr")}>{avgOvr ?? "—"}</KV>
                <KV label={t("game.squad.value")}>{formatCurrency(totalValue)}</KV>
              </div>
            )}
            <Button variant="outline" size="sm" className="min-h-9 w-full" onClick={() => setSection("squad")}>
              {t("game.nav.section.squad")}
              <ArrowRight aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Facilities */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 aria-hidden="true" className="size-4 text-brand" />
              {t("game.nav.facilities")}
            </CardTitle>
            <CardDescription>{t("game.club.overview.facilitiesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {profileQ.isLoading ? (
              <Skeleton className="h-20 w-full" aria-hidden="true" />
            ) : Object.entries(profile?.facilities ?? {}).length === 0 ? (
              <EmptyState title={t("common.empty")} className="py-4" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(profile?.facilities ?? {}).map(([type, level]) => (
                  <Badge key={type} variant="outline" className="text-xs">
                    {t(`facility.${type}`)} · {level}/10
                  </Badge>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="min-h-9 w-full" onClick={() => setSection("club", "facilities")}>
              {t("game.nav.facilities")}
              <ArrowRight aria-hidden="true" className="ml-1 size-4" />
            </Button>
          </CardContent>
        </Card>

        {/* Top players */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users aria-hidden="true" className="size-4 text-brand" />
              {t("game.club.overview.topPlayers")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profileQ.isLoading ? (
              <Skeleton className="h-28 w-full" aria-hidden="true" />
            ) : topPlayers.length === 0 ? (
              <EmptyState title={t("game.squad.empty")} className="py-4" icon={Users} />
            ) : (
              <ul className="space-y-1.5">
                {topPlayers.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                    <span className="w-10 shrink-0 text-[10px] font-semibold uppercase text-muted-foreground">{p.position}</span>
                    <span className="min-w-0 flex-1 truncate">{p.firstName} {p.lastName}</span>
                    <span className="font-mono text-xs tabular-nums text-brand-soft">OVR {p.ovr}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
