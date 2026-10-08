"use client";
// Knight FM — Youth academy view (Task 4-a + 3-b gating).
// Prospect cards (age 14-17, quality range that narrows with report depth,
// attribute bars), scout session button (requires SCOUT staff, rate limited)
// and promotion at 18+ (server-enforced ICP capacity + academy quality cap).
// Status card: best-scout info (or SCOUT_REQUIRED warning) + academy cap.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Binoculars, FlaskConical, Search, UserCheck, UserPlus, UserX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { fetchYouth, qk, type YouthProspect } from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { EmptyState, ErrorState, PositionBadge } from "@/components/game/ui/bits";
import CinemaHeader from "@/components/game/ui/cinema-header";

function ProspectCard({
  prospect,
  promotionAge,
  academyCap,
  academyLevel,
  onPromote,
  promoting,
  onReject,
  rejecting,
}: {
  prospect: YouthProspect;
  promotionAge: number;
  academyCap: number;
  academyLevel: number;
  onPromote: (p: YouthProspect) => void;
  promoting: boolean;
  onReject: (p: YouthProspect) => void;
  rejecting: boolean;
}) {
  const { t } = useI18n();
  const families = ["technical", "physical", "mental"] as const;
  const rangeWidth = prospect.qualityRange.max - prospect.qualityRange.min;
  const [confirmReject, setConfirmReject] = React.useState(false);

  return (
    <Card className={cn(prospect.signable && "border-primary/40")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="truncate">
            {prospect.firstName} {prospect.lastName}
          </span>
          <PositionBadge pos={prospect.position} />
          <Badge
            variant="outline"
            className={cn(
              prospect.scouted
                ? "border-primary/40 text-primary"
                : "border-muted-foreground/40 text-muted-foreground"
            )}
          >
            {prospect.scouted ? t("game.youth.scouted") : t("game.youth.unscouted")}
          </Badge>
          {prospect.promotable && !prospect.signable && (
            <Badge
              variant="outline"
              className={cn(
                prospect.aboveCap
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-muted-foreground/40 text-muted-foreground"
              )}
            >
              {prospect.aboveCap ? t("game.youth.aboveCap") : t("game.youth.signLocked")}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          {t("common.age")} {prospect.age} · {t("game.youth.report", { n: prospect.reportDepth })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Quality + estimated range */}
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t("game.youth.quality")}</span>
            <span className="font-mono font-bold tabular-nums">{prospect.quality}</span>
          </div>
          <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute h-full rounded-full bg-primary/70"
              style={{
                left: `${prospect.qualityRange.min}%`,
                width: `${Math.max(2, rangeWidth)}%`,
              }}
              aria-hidden="true"
            />
            <div
              className="absolute top-0 h-full w-0.5 bg-primary"
              style={{ left: `${prospect.quality}%` }}
              aria-hidden="true"
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("game.youth.range")}: {prospect.qualityRange.min}–{prospect.qualityRange.max}
          </p>
        </div>

        {/* Attribute bars (radar-ish) */}
        <div className="space-y-1">
          {families.map((fam) => {
            const attrs = prospect.attributes?.[fam] ?? {};
            const values = Object.values(attrs);
            const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
            return (
              <div key={fam} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] text-muted-foreground">{t(`game.squad.attrs.${fam}`)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      (avg ?? 0) >= 60 ? "bg-primary" : (avg ?? 0) >= 40 ? "bg-amber-500" : "bg-destructive"
                    )}
                    style={{ width: `${avg ?? 0}%` }}
                  />
                </div>
                <span className="w-7 text-right font-mono text-[11px] tabular-nums">{avg ?? "—"}</span>
              </div>
            );
          })}
        </div>

        {/* Sign / discard — the manager CHOOSES who joins and who does not (Task 21) */}
        {prospect.promotable ? (
          prospect.signable ? (
            <Button
              className="min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={promoting || rejecting}
              onClick={() => onPromote(prospect)}
            >
              <UserCheck aria-hidden="true" className="mr-1.5 size-4" />
              {t("game.youth.promote")}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-11 w-full"
              disabled
              title={t("game.youth.academyCap", { cap: academyCap, level: academyLevel })}
            >
              {t("game.youth.promote")}
            </Button>
          )
        ) : (
          <Button variant="outline" className="min-h-11 w-full" disabled>
            {t("game.youth.promoteAt", { age: promotionAge })}
          </Button>
        )}
        <Button
          variant="outline"
          className="min-h-11 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={promoting || rejecting}
          aria-label={`${t("game.youth.reject")} ${prospect.firstName} ${prospect.lastName}`}
          onClick={() => setConfirmReject(true)}
        >
          <UserX aria-hidden="true" className="mr-1.5 size-4" />
          {t("game.youth.reject")}
        </Button>

        {/* Discard confirmation (Task 21: not every prospect joins the team) */}
        <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("game.youth.rejectTitle", { name: `${prospect.firstName} ${prospect.lastName}` })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("game.youth.rejectDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
                disabled={rejecting}
                onClick={(e) => {
                  e.preventDefault();
                  onReject(prospect);
                  setConfirmReject(false);
                }}
              >
                {rejecting ? "…" : t("game.youth.reject")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default function YouthView() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Task 23-e: operate on the ACTIVE club (top-bar switcher).
  const { club, isLoading: clubsLoading } = useActiveClub();
  const clubId = club?.id ?? "";

  const query = useQuery({
    queryKey: qk.youth(clubId),
    queryFn: () => fetchYouth(clubId),
    enabled: !!clubId,
  });

  const scoutMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ scouted: number }>("/api/youth/scout", { method: "POST", body: { clubId } }),
    onSuccess: (res) => {
      toast({ title: t("game.youth.scoutedToast", { n: res.scouted }) });
      void queryClient.invalidateQueries({ queryKey: qk.youth(clubId) });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({ title: localized, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (prospectId: string) =>
      apiFetch<{ name: string; ovr: number }>("/api/youth/promote", {
        method: "POST",
        body: { prospectId },
      }),
    onSuccess: (res) => {
      toast({ title: t("game.youth.promoted", { name: res.name, ovr: res.ovr }) });
      void queryClient.invalidateQueries({ queryKey: qk.youth(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.players(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({ title: localized, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    },
  });

  // Task 21 — the manager decides who does NOT join: discard a prospect.
  const rejectMutation = useMutation({
    mutationFn: (prospectId: string) =>
      apiFetch<{ id: string; rejected: boolean }>(`/api/youth/prospects/${encodeURIComponent(prospectId)}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({ title: t("game.youth.rejected") });
      void queryClient.invalidateQueries({ queryKey: qk.youth(clubId) });
    },
    onError: (err) => {
      const code = err instanceof ApiError ? err.code : "";
      const localized = code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
      toast({ title: localized, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    },
  });

  if (!club && clubsLoading) {
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
        <h1 className="text-xl font-semibold">{t("game.youth.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
      </div>
    );
  }

  const prospects = query.data?.prospects ?? [];
  const promotionAge = query.data?.youthPromotionAge ?? 18;
  const academyCap = query.data?.academyQualityCap ?? 0;
  const academyLevel = query.data?.academyLevel ?? 1;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CinemaHeader
        title={t("game.youth.title")}
        subtitle={t("game.youth.subtitle")}
        image="/images/training-dusk.jpg"
        icon={FlaskConical}
        right={
          <div className="flex flex-wrap items-center gap-2">
          {/* Task 26: academy CAPACITY — level 1 holds exactly the base (default 3)
              and grows with every upgrade. Red when the cantera is full. */}
          {typeof query.data?.youthCapacity === "number" && (
            <Badge
              variant="outline"
              aria-label={t("game.youth.capacity", { used: query.data.used ?? 0, capacity: query.data.youthCapacity })}
              className={cn(
                "font-mono tabular-nums",
                (query.data.capacitySpace ?? 1) <= 0
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-primary/40 text-primary"
              )}
            >
              {t("game.youth.capacity", { used: query.data.used ?? 0, capacity: query.data.youthCapacity })}
            </Badge>
          )}
          {/* Once-per-day scout limit (Task 21) — usage chip mirrors training */}
          <Badge
            variant="outline"
            aria-label={t("game.youth.scoutUsage", { used: query.data?.scoutedToday ? 1 : 0, max: 1 })}
            className={cn(
              "font-mono tabular-nums",
              query.data?.scoutedToday
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {query.data?.scoutedToday ? "1/1" : "0/1"}
          </Badge>
          <Button
            className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={
              scoutMutation.isPending ||
              !!query.data?.scoutedToday ||
              (query.data ? (query.data.capacitySpace ?? 1) <= 0 : false)
            }
            title={
              query.data?.scoutedToday
                ? t("game.youth.scoutUsed")
                : query.data && (query.data.capacitySpace ?? 1) <= 0
                  ? t("game.youth.capacityFull")
                  : undefined
            }
            onClick={() => scoutMutation.mutate()}
          >
            <Search aria-hidden="true" className="mr-1.5 size-4" />
            {scoutMutation.isPending
              ? "…"
              : t("game.youth.scout", { n: query.data?.prospectsPerSession ?? query.data?.scoutStars ?? 1 })}
          </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">{t("game.youth.promotionNote")}</p>

      {/* Status card: best scout (or warning) + academy quality cap */}
      {query.data && (
        <Card>
          <CardContent className="space-y-3 p-4">
            {query.data.hasScout && query.data.bestScout ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm">
                  <UserCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
                  <span>
                    {t("game.youth.scoutStatus", {
                      name: query.data.bestScout.name,
                      quality: query.data.bestScout.quality,
                    })}
                  </span>
                </p>
                {/* Task 23-a: prospects per session = scout's stars (1★→1 … 5★→5). */}
                {(query.data.scoutStars ?? 0) > 0 && (
                  <p className="flex items-center gap-1.5 pl-6 text-xs font-medium text-primary">
                    <Binoculars aria-hidden="true" className="size-3.5" />
                    {t("game.youth.scoutProspectsNote", {
                      stars: query.data.scoutStars ?? 0,
                      n: query.data.prospectsPerSession ?? query.data.scoutStars ?? 0,
                    })}
                  </p>
                )}
              </div>
            ) : (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTriangle aria-hidden="true" className="size-4 text-amber-400" />
                <AlertTitle>{t("game.youth.scoutRequired")}</AlertTitle>
                <AlertDescription>{t("game.youth.noScout")}</AlertDescription>
              </Alert>
            )}
            <div>
              <Badge
                variant="outline"
                className="border-muted-foreground/40 bg-muted/40 text-muted-foreground"
              >
                {t("game.youth.academyCap", { cap: academyCap, level: academyLevel })}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full" aria-hidden="true" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : prospects.length === 0 ? (
        <EmptyState title={t("game.youth.empty")} icon={UserPlus} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {prospects.map((p) => (
            <ProspectCard
              key={p.id}
              prospect={p}
              promotionAge={promotionAge}
              academyCap={academyCap}
              academyLevel={academyLevel}
              onPromote={(prospect) => promoteMutation.mutate(prospect.id)}
              promoting={promoteMutation.isPending}
              onReject={(prospect) => rejectMutation.mutate(prospect.id)}
              rejecting={rejectMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
