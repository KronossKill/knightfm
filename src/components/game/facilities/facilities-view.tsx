"use client";
// Knight FM — Facilities view (Task 4-a).
// 5 facility cards (level badge, 10-segment bar, live upgrade progress with
// completesAt countdown), ICP summary card and OWNER-only upgrade flow with
// cost preview + confirmation (server debits atomically; scheduler completes).

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Building2, FlaskConical, HardHat, HeartPulse, Landmark, Microscope } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/components/auth/store";
import {
  fetchFacilities,
  qk,
  type FacilityView,
} from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { ErrorState, SegmentedBar, formatCountdown, useNow } from "@/components/game/ui/bits";

const FACILITY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  STADIUM: Landmark,
  TRAINING_CENTER: HardHat,
  YOUTH_ACADEMY: FlaskConical,
  MEDICAL_CENTER: HeartPulse,
  SPORTS_SCIENCE: Microscope,
  REST_ROOMS: BedDouble,
};

// AI-generated condition renders: /facilities/<slug>-t<1..5>.jpg (Task 2-img).
// Tier formula: Math.min(5, Math.ceil(level / 2)) → L1-2=t1 … L9-10=t5.
const FACILITY_IMAGES: Record<string, string> = {
  STADIUM: "/facilities/stadium",
  TRAINING_CENTER: "/facilities/training-center",
  YOUTH_ACADEMY: "/facilities/youth-academy",
  MEDICAL_CENTER: "/facilities/medical-center",
  SPORTS_SCIENCE: "/facilities/sports-science",
  REST_ROOMS: "/facilities/rest-rooms",
};

function FacilityCard({
  facility,
  maxLevel,
  isOwner,
  restRecovery,
  onUpgrade,
}: {
  facility: FacilityView;
  maxLevel: number;
  isOwner: boolean;
  restRecovery: number | undefined;
  onUpgrade: (f: FacilityView) => void;
}) {
  const { t, formatCurrency, formatDate } = useI18n();
  const nowMs = useNow(1000);
  const Icon = FACILITY_ICONS[facility.type] ?? Building2;
  const atMax = facility.level >= maxLevel;
  const upgrading = !!facility.upgrade;
  const imgBase = FACILITY_IMAGES[facility.type];
  const tier = Math.min(5, Math.ceil(facility.level / 2));
  const targetTier = facility.upgrade ? Math.min(5, Math.ceil(facility.upgrade.toLevel / 2)) : tier;
  const currentCondition = t(`facility.condition.t${tier}`);

  return (
    <Card className={cn(upgrading && "border-amber-500/40")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon aria-hidden="true" className="size-5 text-primary" />
          {t(`facility.${facility.type}`)}
        </CardTitle>
        <CardDescription>
          {t("facility.level", { level: facility.level })}
          {upgrading && facility.upgrade ? ` → ${t("facility.level", { level: facility.upgrade.toLevel })}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* REST_ROOMS effect (Task 9-b): daily fatigue reduction for the whole squad. */}
        {facility.type === "REST_ROOMS" && (
          <p className="text-xs text-muted-foreground">
            {restRecovery != null
              ? t("game.fac.restEffectPerLevel", { n: restRecovery })
              : t("game.fac.restEffect")}
          </p>
        )}

        {imgBase ? (
          <div className="relative">
            <img
              src={`${imgBase}-t${tier}.jpg`}
              alt={currentCondition}
              className="h-40 w-full rounded-lg border object-cover"
              loading="lazy"
            />
            <Badge className="absolute bottom-2 left-2 bg-background/85 text-xs backdrop-blur">
              {currentCondition}
            </Badge>
          </div>
        ) : null}

        <SegmentedBar level={facility.level} max={maxLevel} />

        {upgrading && facility.upgrade && imgBase ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-amber-200">
              → {t("game.fac.preview")}: {t(`facility.condition.t${targetTier}`)}
            </p>
            <img
              src={`${imgBase}-t${targetTier}.jpg`}
              alt={t(`facility.condition.t${targetTier}`)}
              className="h-24 w-full rounded-lg border object-cover"
              loading="lazy"
            />
          </div>
        ) : null}

        {upgrading && facility.upgrade ? (
          <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
              <HardHat aria-hidden="true" className="size-3.5" />
              {t("game.fac.inProgress", { date: formatDate(facility.upgrade.completesAt) })}
            </p>
            <Progress value={facility.upgrade.progressPct} aria-label={`${t("game.fac.progress")}: ${facility.upgrade.progressPct}%`} />
            <p className="text-right font-mono text-xs tabular-nums text-amber-200/90">
              {nowMs > 0 ? formatCountdown(new Date(facility.upgrade.completesAt).getTime(), nowMs) : "--:--:--"}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {t("game.fac.cost")}:{" "}
              <span className="font-mono">
                {facility.nextLevelCost !== null ? formatCurrency(facility.nextLevelCost) : "—"}
              </span>
            </span>
            <span>{facility.durationDays}d</span>
          </div>
        )}

        {atMax ? (
          <Badge variant="outline" className="w-full justify-center border-primary/40 text-primary">
            {t("facility.maxLevel")}
          </Badge>
        ) : (
          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={upgrading || !isOwner}
            title={!isOwner ? t("game.fac.ownerOnly") : undefined}
            onClick={() => onUpgrade(facility)}
          >
            {t("facility.upgrade", { level: facility.level + 1 })}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function FacilitiesView() {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [upgradeTarget, setUpgradeTarget] = React.useState<FacilityView | null>(null);

  // Task 23-e: operate on the ACTIVE club (top-bar switcher) — every club owns
  // its facilities independently, even under the same owner.
  const { club, isLoading } = useActiveClub();
  const clubId = club?.id ?? "";
  const isOwner = club?.role === "OWNER";

  const query = useQuery({
    queryKey: qk.facilities(clubId),
    queryFn: () => fetchFacilities(clubId),
    enabled: !!clubId,
    refetchInterval: 60_000,
  });

  const upgradeMutation = useMutation({
    mutationFn: (type: string) =>
      apiFetch<{ started: boolean; toLevel: number }>("/api/facilities/upgrade", {
        method: "POST",
        body: { clubId, type },
      }),
    onSuccess: (res) => {
      toast({
        title: t("game.fac.started", {
          facility: upgradeTarget ? t(`facility.${upgradeTarget.type}`) : "",
          level: res.toLevel,
        }),
      });
      setUpgradeTarget(null);
      void queryClient.invalidateQueries({ queryKey: qk.facilities(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({ title: localized, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    },
  });

  if (!club && isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{t("game.fac.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
      </div>
    );
  }

  const data = query.data;
  const icp = data?.icp;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Building2 aria-hidden="true" className="size-5 text-primary" />
          {t("game.fac.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("game.fac.subtitle")}
          {club ? <span className="font-medium text-foreground"> · {club.name}</span> : null}
        </p>
      </header>

      {/* ICP summary */}
      <Card className="border-primary/25">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Microscope aria-hidden="true" className="size-4 text-primary" />
            {t("game.fac.icpTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!icp ? (
            <Skeleton className="h-10 w-full" aria-hidden="true" />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{t("game.fac.icp")}</p>
                <p className="font-mono text-lg font-bold text-primary">{icp.icp}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{t("game.fac.baseCapacity")}</p>
                <p className="font-mono text-lg">{icp.baseCapacity}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{t("game.fac.bonusSlots")}</p>
                <p className="font-mono text-lg text-primary">+{icp.bonusSlots}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{t("game.fac.finalCapacity")}</p>
                <p className="font-mono text-lg font-bold">{icp.finalCapacity}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">{t("game.fac.squadUsage", { n: icp.playerCount, cap: icp.finalCapacity })}</p>
                <Progress
                  value={icp.finalCapacity > 0 ? (icp.playerCount / icp.finalCapacity) * 100 : 0}
                  className="mt-2"
                  aria-label={t("game.fac.squadUsage", { n: icp.playerCount, cap: icp.finalCapacity })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!isOwner && <p className="text-xs text-muted-foreground">{t("game.fac.ownerOnly")}</p>}

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-56 w-full" aria-hidden="true" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.facilities.map((f) => (
            <FacilityCard
              key={f.type}
              facility={f}
              maxLevel={data!.config.maxLevel}
              isOwner={!!isOwner}
              restRecovery={data!.config.restRecoveryPerLevel}
              onUpgrade={setUpgradeTarget}
            />
          ))}
        </div>
      )}

      {/* Upgrade confirmation */}
      <AlertDialog open={!!upgradeTarget} onOpenChange={(v) => !v && setUpgradeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("game.fac.confirmTitle", {
                facility: upgradeTarget ? t(`facility.${upgradeTarget.type}`) : "",
                level: upgradeTarget ? upgradeTarget.level + 1 : 0,
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("game.fac.confirmDesc", {
                cost: formatCurrency(upgradeTarget?.nextLevelCost ?? 0),
                days: upgradeTarget?.durationDays ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={upgradeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (upgradeTarget) upgradeMutation.mutate(upgradeTarget.type);
              }}
            >
              {upgradeMutation.isPending ? "…" : t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
