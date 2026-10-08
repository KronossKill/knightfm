"use client";
// Knight FM — Staff view (Task 9-b, star-first hiring UX added in Task 20).
// 5 technical areas (COACH / SCOUT / MEDIC / PHYSIO / ANALYST): hired staff per
// area (quality, specialization, salary, release with severance confirm) and a
// two-step hiring flow — the user FIRST picks the member's quality (1–5 stars,
// gated by the area's facility level) and THEN the person from that star's
// daily-rotating candidate pool. Fees debit the CLUB treasury.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BedDouble,
  Binoculars,
  ClipboardList,
  HeartPulse,
  LineChart,
  Lock,
  Star,
  UsersRound,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import CinemaHeader from "@/components/game/ui/cinema-header";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/components/auth/store";
import {
  fetchStaff,
  fetchStaffCandidates,
  fetchWorldState,
  qk,
  type StaffAreaMeta,
  type StaffMember,
  type StaffRole,
} from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { starsFor } from "@/lib/staff-quality";
import { ErrorState } from "@/components/game/ui/bits";

const AREAS: { role: StaffRole; icon: React.ComponentType<{ className?: string }> }[] = [
  { role: "COACH", icon: ClipboardList },
  { role: "SCOUT", icon: Binoculars },
  { role: "MEDIC", icon: HeartPulse },
  { role: "PHYSIO", icon: BedDouble },
  { role: "ANALYST", icon: LineChart },
];

/** Quality badge tone (same thresholds as the squad state bars). */
function qualityBadgeClass(quality: number): string {
  if (quality >= 70) return "border-primary/40 bg-primary/10 text-primary";
  if (quality >= 40) return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-destructive/40 bg-destructive/10 text-destructive";
}

/** Star widget for a staff quality value (filled vs. empty stars + localized label). */
function QualityStars({ quality, label }: { quality: number; label: string }) {
  const n = starsFor(quality);
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn(
            "size-3",
            i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}

/** Concrete in-game effect of a staff member at their quality (mirrors the
 *  engine: training.ts coach multiplier, scheduler.ts recovery/healing/form,
 *  youth/scout prospect quality). Shown in the UI so quality → possibilities
 *  is transparent. */
function roleEffectValue(role: StaffRole, quality: number): number {
  switch (role) {
    case "COACH":
      return Math.round((1 + (quality - 40) * 0.00375) * 100);
    case "SCOUT":
      return Math.round(quality * 0.4);
    case "MEDIC":
      return Math.round(12 + quality * 0.25);
    case "PHYSIO":
      return Math.floor(quality / 25);
    case "ANALYST":
      return quality >= 85 ? 2 : quality >= 55 ? 1 : 0;
  }
}

/** Localize a COACH specialization ("technical" | "physical" | "mental" | "set_pieces"); raw value as fallback. */
function specLabel(spec: string, t: (key: string) => string): string {
  const key = spec === "set_pieces" ? "game.training.spfocus.set_pieces" : `game.training.focus.${spec}`;
  const localized = t(key);
  return localized === key ? spec : localized;
}

interface AreaCardProps {
  clubId: string;
  day: number;
  role: StaffRole;
  icon: React.ComponentType<{ className?: string }>;
  meta: StaffAreaMeta;
  hired: StaffMember[];
  count: number;
  maxPerRole: number;
  treasury: number;
  /** candidateId currently being hired (parent-level mutation). */
  pendingCandidateId: string | null;
  /** True while any hire in this view is in flight (blocks double submits). */
  hiring: boolean;
  onHire: (input: { role: StaffRole; stars: number; candidateId: string }) => void;
  onRelease: (m: StaffMember) => void;
}

/** One technical area card: hired staff + the star-first hiring flow. */
function AreaCard({
  clubId,
  day,
  role,
  icon: Icon,
  meta,
  hired,
  count,
  maxPerRole,
  treasury,
  pendingCandidateId,
  hiring,
  onHire,
  onRelease,
}: AreaCardProps) {
  const { t, formatCurrency } = useI18n();

  // Step 1 state — the chosen star quality for this area (null = not chosen yet).
  const [stars, setStars] = React.useState<number | null>(null);

  const maxReached = count >= maxPerRole;
  const hiredHeading = t("game.staff.hiredTitle", { count, max: maxPerRole });

  // Step 2 data — the daily candidate pool for the chosen star quality.
  const candsQ = useQuery({
    queryKey: qk.staffCands(clubId, role, stars ?? 0, day),
    queryFn: () => fetchStaffCandidates(clubId, role, stars as number),
    enabled: stars !== null,
  });

  const facilityName = t(`facility.${meta.facilityType}`);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon aria-hidden="true" className="size-5 text-primary" />
            {t(`game.staff.area.${role}`)}
          </CardTitle>
          <Badge
            variant="outline"
            aria-label={hiredHeading}
            className={cn(
              "font-mono tabular-nums",
              maxReached
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {count}/{maxPerRole}
          </Badge>
        </div>
        <CardDescription>{t(`game.staff.effect.${role}`)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Hired staff */}
        <section aria-label={hiredHeading}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {hiredHeading}
          </p>
          {hired.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
              {t("game.staff.empty")}
            </p>
          ) : (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto pr-1">
              {hired.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="block truncate text-sm font-medium">{m.name}</span>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <QualityStars quality={m.quality} label={t("game.staff.stars", { n: starsFor(m.quality) })} />
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-mono tabular-nums", qualityBadgeClass(m.quality))}
                      >
                        {m.quality}
                        <span className="sr-only"> {t("game.staff.quality")}</span>
                      </Badge>
                      {m.specialization && (
                        <Badge variant="outline" className="text-[10px]">
                          {specLabel(m.specialization, t)}
                        </Badge>
                      )}
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {t("game.staff.salaryDay", { salary: formatCurrency(m.salary) })}
                      </span>
                    </span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">
                      {t(`game.staff.effectAt.${role}`, { value: roleEffectValue(role, m.quality) })}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-11 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`${t("game.staff.release")} ${m.name}`}
                    onClick={() => onRelease(m)}
                  >
                    <UserX aria-hidden="true" className="mr-1 size-3.5" />
                    {t("game.staff.release")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Star-first hiring flow */}
        <section aria-label={t("game.staff.hireTitle")} className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("game.staff.hireTitle")}
          </p>

          {/* Step 1 — choose the member's quality in stars */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("game.staff.stepStars")}</p>
            <div role="group" aria-label={t("game.staff.stepStars")} className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((k) => {
                const locked = k > meta.maxStars;
                const selected = stars === k;
                const reqText = t("game.staff.starReq", {
                  facility: facilityName,
                  level: meta.starRequirements[k] ?? 1,
                });
                return (
                  <button
                    key={k}
                    type="button"
                    disabled={maxReached || locked}
                    aria-pressed={selected}
                    aria-label={t("game.staff.stars", { n: k }) + (locked ? ` — ${reqText}` : "")}
                    title={locked ? reqText : undefined}
                    onClick={() => setStars((prev) => (prev === k ? null : k))}
                    className={cn(
                      "flex h-11 items-center justify-center gap-1 rounded-lg border text-sm font-semibold transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/40"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      (maxReached || locked) && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span aria-hidden="true">{k}</span>
                    {locked ? (
                      <Lock aria-hidden="true" className="size-3.5" />
                    ) : (
                      <Star
                        aria-hidden="true"
                        className={cn("size-3.5", selected && "fill-amber-400 text-amber-400")}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {meta.maxStars < 5 && (
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t("game.staff.facilityCap", {
                  facility: facilityName,
                  level: meta.facilityLevel,
                  stars: meta.maxStars,
                })}
              </p>
            )}
          </div>

          {/* Step 2 — choose the person from that star's daily pool */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium">{t("game.staff.stepPerson")}</p>
            {stars === null ? (
              <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                {t("game.staff.pickStarsFirst")}
              </p>
            ) : candsQ.isLoading ? (
              <div className="space-y-2" aria-hidden="true">
                <Skeleton className="h-[72px] w-full" />
                <Skeleton className="h-[72px] w-full" />
              </div>
            ) : candsQ.isError ? (
              <ErrorState message={t("err.generic")} onRetry={() => void candsQ.refetch()} />
            ) : (candsQ.data?.candidates.length ?? 0) === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">
                {t("game.staff.noCandidates")}
              </p>
            ) : (
              <ul className="space-y-2" aria-label={t("game.staff.candidatesOf", { stars })}>
                {candsQ.data?.candidates.map((c) => {
                  const hiringThis = pendingCandidateId === c.id;
                  const insufficient = treasury < c.hireFee;
                  return (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <QualityStars quality={c.quality} label={t("game.staff.stars", { n: starsFor(c.quality) })} />
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] font-mono tabular-nums", qualityBadgeClass(c.quality))}
                          >
                            {c.quality}
                            <span className="sr-only"> {t("game.staff.quality")}</span>
                          </Badge>
                          {c.specialization && (
                            <Badge variant="outline" className="text-[10px]">
                              {specLabel(c.specialization, t)}
                            </Badge>
                          )}
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {t("game.staff.hireFee", { fee: formatCurrency(c.hireFee) })}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                            {t("game.staff.salaryDay", { salary: formatCurrency(c.salary) })}
                          </span>
                        </span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {t(`game.staff.effectAt.${role}`, { value: roleEffectValue(role, c.quality) })}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        className="min-h-11 bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={maxReached || insufficient || hiring}
                        title={
                          maxReached
                            ? t("game.staff.maxReached")
                            : insufficient
                              ? t("game.staff.insufficient")
                              : undefined
                        }
                        aria-label={`${t("game.staff.hire")} ${c.name}`}
                        onClick={() => onHire({ role, stars: c.stars, candidateId: c.id })}
                      >
                        {hiringThis ? "…" : t("game.staff.hire")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export default function StaffView() {
  const { t, formatCurrency } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [releaseTarget, setReleaseTarget] = React.useState<StaffMember | null>(null);

  // Task 23-e: operate on the ACTIVE club (top-bar switcher) — clubs are fully
  // independent even under the same owner.
  const { club, isLoading: clubsLoading } = useActiveClub();
  const clubId = club?.id ?? "";
  const treasury = club?.operatingFund ?? 0;

  const query = useQuery({
    queryKey: qk.staff(clubId),
    queryFn: () => fetchStaff(clubId),
    enabled: !!clubId,
    refetchInterval: 60_000,
  });

  const errTitle = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    return code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
  };

  // Task 26: dismissal severance = daily salary × REMAINING CONTRACT DAYS
  // (staff contracts run to the end of the season) — same formula as the
  // server (severanceMultiplier defaults to 1).
  const worldQ = useQuery({ queryKey: qk.world, queryFn: fetchWorldState, enabled: releaseTarget != null });
  const season = worldQ.data?.season ?? null;
  const worldDay = worldQ.data?.gameDay ?? 0;
  const daysRemaining = season ? Math.max(0, season.endEpochDay - worldDay + 1) : 0;
  const severanceEstimate = (releaseTarget?.salary ?? 0) * daysRemaining;

  const hireMutation = useMutation({
    mutationFn: (input: { role: StaffRole; stars: number; candidateId: string }) =>
      apiFetch<{ staff: StaffMember; fee: number }>("/api/staff/hire", {
        method: "POST",
        body: { clubId, role: input.role, stars: input.stars, candidateId: input.candidateId },
      }),
    onSuccess: (res) => {
      toast({ title: t("game.staff.hired", { name: res.staff.name, fee: formatCurrency(res.fee) }) });
      // The club treasury was debited → refresh staff + club caches.
      void queryClient.invalidateQueries({ queryKey: qk.staff(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
      // Refresh every open candidate pool of this club (hired persons leave the pool).
      void queryClient.invalidateQueries({ queryKey: ["staff-cands", clubId] });
    },
    onError: (err) => {
      toast({
        title: errTitle(err),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (staffId: string) =>
      apiFetch<{ id: string; released: boolean; severance: number; daysRemaining: number }>("/api/staff/release", {
        method: "POST",
        body: { staffId },
      }),
    onSuccess: () => {
      toast({ title: t("game.staff.released", { name: releaseTarget?.name ?? "" }) });
      setReleaseTarget(null);
      void queryClient.invalidateQueries({ queryKey: qk.staff(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.myClubs });
      void queryClient.invalidateQueries({ queryKey: ["staff-cands", clubId] });
    },
    onError: (err) => {
      toast({
        title: errTitle(err),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
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
        <h1 className="text-xl font-semibold">{t("game.staff.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
      </div>
    );
  }

  const data = query.data;
  const maxPerRole = data?.config.maxPerRole ?? 0;
  const counts = data?.counts ?? {};
  const day = data?.day ?? 0;
  const areasByRole = new Map((data?.areas ?? []).map((a) => [a.role, a]));
  const staffByRole = new Map<StaffRole, StaffMember[]>();
  for (const m of data?.staff ?? []) {
    const list = staffByRole.get(m.role) ?? [];
    list.push(m);
    staffByRole.set(m.role, list);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CinemaHeader
        title={t("game.staff.title")}
        subtitle={t("game.staff.subtitle")}
        image="/images/locker-mood.jpg"
        icon={UsersRound}
      />

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-80 w-full" aria-hidden="true" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {AREAS.map(({ role, icon }) => {
            const meta =
              areasByRole.get(role) ??
              ({
                role,
                facilityType: "TRAINING_CENTER",
                facilityLevel: 1,
                maxStars: 1,
                starRequirements: { 1: 1, 2: 1, 3: 2, 4: 6, 5: 10 },
              } satisfies StaffAreaMeta);
            return (
              <AreaCard
                key={role}
                clubId={clubId}
                day={day}
                role={role}
                icon={icon}
                meta={meta}
                hired={staffByRole.get(role) ?? []}
                count={counts[role] ?? 0}
                maxPerRole={maxPerRole}
                treasury={treasury}
                pendingCandidateId={
                  hireMutation.isPending ? (hireMutation.variables?.candidateId ?? null) : null
                }
                hiring={hireMutation.isPending}
                onHire={(input) => hireMutation.mutate(input)}
                onRelease={(m) => setReleaseTarget(m)}
              />
            );
          })}
        </div>
      )}

      {/* Release confirmation (severance debited from the club treasury) */}
      <AlertDialog open={!!releaseTarget} onOpenChange={(v) => !v && setReleaseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("game.staff.releaseTitle", { name: releaseTarget?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("game.staff.releaseConfirm", {
                name: releaseTarget?.name ?? "",
                severance: formatCurrency(severanceEstimate),
                days: daysRemaining,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
              disabled={releaseMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (releaseTarget) releaseMutation.mutate(releaseTarget.id);
              }}
            >
              {releaseMutation.isPending ? "…" : t("game.staff.release")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
