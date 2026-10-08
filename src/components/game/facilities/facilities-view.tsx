"use client";
// Knight FM — Facilities view (Task 4-a → Task 58 UX restructure).
// "Galería modular": each facility is an image-protagonist card (full-bleed
// render + dark veil) with its upgrade data OVERLAID as floating chips — no
// data stacked under the photo. Clicking a card opens a GLASS side panel
// (Sheet) with the full upgrade detail; the upgrade confirmation AlertDialog
// and the server contract (atomic debit + scheduler completion) are unchanged.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Building2, FlaskConical, HardHat, HeartPulse, Landmark, Microscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import CinemaHeader from "@/components/game/ui/cinema-header";

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

function benefitKey(type: string): string {
  return `game.fac.benefit.${type}`;
}

/** Facility benefit copy (REST_ROOMS uses its live per-level effect instead). */
function BenefitText({ type, restRecovery }: { type: string; restRecovery: number | undefined }) {
  const { t } = useI18n();
  if (type === "REST_ROOMS") {
    return (
      <p className="text-sm text-muted-foreground">
        {restRecovery != null
          ? t("game.fac.restEffectPerLevel", { n: restRecovery })
          : t("game.fac.restEffect")}
      </p>
    );
  }
  return <p className="text-sm text-muted-foreground">{t(benefitKey(type))}</p>;
}

// ── Gallery card (image protagonist, data overlaid) ─────────────

function GalleryCard({
  facility,
  maxLevel,
  onOpen,
}: {
  facility: FacilityView;
  maxLevel: number;
  onOpen: (f: FacilityView) => void;
}) {
  const { t, formatCurrency } = useI18n();
  const nowMs = useNow(1000);
  const Icon = FACILITY_ICONS[facility.type] ?? Building2;
  const atMax = facility.level >= maxLevel;
  const upgrading = !!facility.upgrade;
  const imgBase = FACILITY_IMAGES[facility.type];
  const tier = Math.min(5, Math.ceil(facility.level / 2));
  const condition = t(`facility.condition.t${tier}`);

  return (
    <button
      type="button"
      onClick={() => onOpen(facility)}
      aria-label={t("game.fac.openDetails", { facility: t(`facility.${facility.type}`) })}
      className={cn(
        "player-card group relative block w-full overflow-hidden rounded-xl border text-left",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        upgrading && "border-amber-500/50",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {imgBase && (
          <img
            src={`${imgBase}-t${tier}.jpg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            loading="lazy"
          />
        )}
        {/* Legibility veil: dark at the bottom where text sits */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" aria-hidden="true" />

        {/* Floating chips — level + next-level cost (or MAX) */}
        <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1.5">
          <Badge className="bg-background/85 text-xs text-foreground backdrop-blur">
            {t("facility.level", { level: facility.level })}
          </Badge>
          {!atMax && !upgrading && facility.nextLevelCost !== null && (
            <Badge variant="outline" className="border-border/70 bg-background/85 font-mono text-[11px] backdrop-blur">
              {formatCurrency(facility.nextLevelCost)}
            </Badge>
          )}
          {atMax && (
            <Badge variant="outline" className="border-primary/40 bg-background/85 text-[11px] text-primary backdrop-blur">
              {t("facility.maxLevel")}
            </Badge>
          )}
        </div>

        {/* Bottom overlay: identity + condition + live upgrade progress */}
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-3.5">
          <div className="flex items-end justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
              <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
              <span className="truncate">{t(`facility.${facility.type}`)}</span>
            </p>
            <span className="shrink-0 rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
              {condition}
            </span>
          </div>

          {upgrading && facility.upgrade ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
                <HardHat aria-hidden="true" className="size-3.5" />
                {t("facility.level", { level: facility.upgrade.toLevel })} · {t("game.fac.progress")}
              </p>
              <Progress value={facility.upgrade.progressPct} aria-label={`${t("game.fac.progress")}: ${facility.upgrade.progressPct}%`} />
              <p className="text-right font-mono text-xs tabular-nums text-amber-200/90">
                {nowMs > 0 ? formatCountdown(new Date(facility.upgrade.completesAt).getTime(), nowMs) : "--:--:--"}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {atMax
                ? t("facility.maxLevel")
                : facility.nextLevelCost !== null
                  ? `${t("game.fac.cost")}: ${formatCurrency(facility.nextLevelCost)} · ${t("game.fac.durationDays", { n: facility.durationDays })}`
                  : "—"}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Glass side panel (upgrade detail without leaving the screen) ─

function FacilityPanel({
  facility,
  maxLevel,
  isOwner,
  restRecovery,
  open,
  onOpenChange,
  onUpgrade,
}: {
  facility: FacilityView | null;
  maxLevel: number;
  isOwner: boolean;
  restRecovery: number | undefined;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpgrade: (f: FacilityView) => void;
}) {
  const { t, formatCurrency, formatDate } = useI18n();
  const nowMs = useNow(1000);

  const tier = facility ? Math.min(5, Math.ceil(facility.level / 2)) : 1;
  const targetTier = facility?.upgrade ? Math.min(5, Math.ceil(facility.upgrade.toLevel / 2)) : tier;
  const imgBase = facility ? FACILITY_IMAGES[facility.type] : undefined;
  const atMax = facility ? facility.level >= maxLevel : false;
  const upgrading = facility ? !!facility.upgrade : false;
  const Icon = facility ? FACILITY_ICONS[facility.type] ?? Building2 : Building2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass w-full overflow-y-auto p-0 sm:max-w-md">
        {facility && (
          <>
            {/* Photo header */}
            <div className="relative h-40 w-full overflow-hidden sm:h-48">
              {imgBase && (
                <img
                  src={`${imgBase}-t${tier}.jpg`}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" aria-hidden="true" />
              <SheetHeader className="absolute inset-x-0 bottom-0 space-y-1 p-4">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Icon aria-hidden="true" className="size-5 text-primary" />
                  {t(`facility.${facility.type}`)}
                </SheetTitle>
                <SheetDescription>
                  {t("facility.level", { level: facility.level })}
                  {upgrading && facility.upgrade
                    ? ` → ${t("facility.level", { level: facility.upgrade.toLevel })}`
                    : ` · ${t(`facility.condition.t${tier}`)}`}
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="space-y-4 p-4">
              {/* Benefit (honest per-type copy) */}
              <BenefitText type={facility.type} restRecovery={restRecovery} />

              {/* Level bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("game.fac.levelProgress", { level: facility.level, max: maxLevel })}</span>
                </div>
                <SegmentedBar level={facility.level} max={maxLevel} />
              </div>

              {/* Live upgrade progress */}
              {upgrading && facility.upgrade ? (
                <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-200">
                    <HardHat aria-hidden="true" className="size-3.5" />
                    {t("game.fac.inProgress", { date: formatDate(facility.upgrade.completesAt) })}
                  </p>
                  <Progress value={facility.upgrade.progressPct} aria-label={`${t("game.fac.progress")}: ${facility.upgrade.progressPct}%`} />
                  <p className="text-right font-mono text-xs tabular-nums text-amber-200/90">
                    {nowMs > 0 ? formatCountdown(new Date(facility.upgrade.completesAt).getTime(), nowMs) : "--:--:--"}
                  </p>
                  {imgBase && (
                    <div className="space-y-1 pt-1">
                      <p className="text-xs text-muted-foreground">
                        {t("game.fac.preview")}: {t(`facility.condition.t${targetTier}`)}
                      </p>
                      <img
                        src={`${imgBase}-t${targetTier}.jpg`}
                        alt={t(`facility.condition.t${targetTier}`)}
                        className="h-24 w-full rounded-lg border object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.fac.cost")}</p>
                    <p className="font-mono text-sm font-semibold">
                      {facility.nextLevelCost !== null ? formatCurrency(facility.nextLevelCost) : "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.fac.durationTitle")}</p>
                    <p className="font-mono text-sm font-semibold">{t("game.fac.durationDays", { n: facility.durationDays })}</p>
                  </div>
                </div>
              )}

              {/* Upgrade action (OWNER only) */}
              {atMax ? (
                <Badge variant="outline" className="w-full justify-center border-primary/40 text-primary">
                  {t("facility.maxLevel")}
                </Badge>
              ) : isOwner ? (
                <Button
                  className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={upgrading}
                  onClick={() => onUpgrade(facility)}
                >
                  {t("facility.upgrade", { level: facility.level + 1 })}
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">{t("game.fac.ownerOnly")}</p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── View ─────────────────────────────────────────────────────────

export default function FacilitiesView() {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detailTarget, setDetailTarget] = React.useState<FacilityView | null>(null);
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
  // Keep the open panel in sync with live data (upgrade progress ticks via refetch).
  const detail = detailTarget ? data?.facilities.find((f) => f.type === detailTarget.type) ?? null : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CinemaHeader
        title={t("game.fac.title")}
        subtitle={
          club
            ? `${t("game.fac.subtitle")} · ${club.name}`
            : t("game.fac.subtitle")
        }
        image="/images/stadium-night.jpg"
        icon={Building2}
      />

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
            <Skeleton key={i} className="aspect-[4/3] w-full" aria-hidden="true" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data!.facilities.map((f) => (
            <GalleryCard key={f.type} facility={f} maxLevel={data!.config.maxLevel} onOpen={setDetailTarget} />
          ))}
        </div>
      )}

      {/* Task 58 — glass side panel with the full upgrade detail */}
      <FacilityPanel
        facility={detail}
        maxLevel={data?.config.maxLevel ?? 10}
        isOwner={!!isOwner}
        restRecovery={data?.config.restRecoveryPerLevel}
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetailTarget(null);
        }}
        onUpgrade={setUpgradeTarget}
      />

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
