"use client";
// Knight FM — Training view (Task 12 rework; Task 19 redesign of individual).
// Two clear sections:
//  - GENERAL training: ONE single button (no focus picking). Running it raises
//    EVERY attribute of EVERY squad player — the server defaults the session
//    focus to "balanced". Limit: 1 per day (configurable).
//  - INDIVIDUAL training: ONE CARD PER SPECIALIZATION TYPE, each with its own
//    dropdown of eligible squad players (position badge beside every name) and
//    its own run button + daily usage chip. Limit: 1 session of each type/day.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Dumbbell,
  Flag,
  Goal,
  Info,
  Layers,
  Play,
  Shield,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, ApiError } from "@/components/auth/store";
import {
  fetchMyClubs,
  fetchPlayers,
  fetchTraining,
  qk,
  type PlayerRow,
  type TrainingSpecialType,
} from "@/components/game/api";
import { ErrorState, PositionBadge, posGroupOf } from "@/components/game/ui/bits";
import CinemaHeader from "@/components/game/ui/cinema-header";
import { useViewStore } from "@/components/game/view-store";

const SPECIAL_RUN_TYPES: TrainingSpecialType[] = [
  "goalkeeper",
  "defense",
  "midfield",
  "wide",
  "attack",
  "physical",
  "set_pieces",
];

const TYPE_ICONS: Record<TrainingSpecialType, LucideIcon> = {
  goalkeeper: Goal,
  defense: Shield,
  midfield: Layers,
  wide: ArrowLeftRight,
  attack: Target,
  physical: Dumbbell,
  set_pieces: Flag,
};

// ── Task 25-c: multi-factor breakdown shown in session toasts ────

type TrainingFactorWeights = Record<"condition" | "age" | "quality" | "coach" | "facility", number>;

interface TrainingBreakdown {
  fCondition: number;
  fAge: number;
  fQuality: number;
  fCoach: number;
  fFacility: number;
  weights: TrainingFactorWeights;
  eff: TrainingFactorWeights;
  finalPct: number;
}

/**
 * "+2.0% · condición ×0.78 · edad ×0.92 · calidad ×1.01 · entrenador ×1.00 ·
 * instalaciones ×0.90" — shows the APPLIED (randomized) pct plus the effective
 * (weighted) factor multipliers that were actually applied; at default weights
 * (100) the effective multipliers equal the raw factors.
 */
function breakdownText(
  bd: TrainingBreakdown | undefined,
  appliedPct: number | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string
): string | undefined {
  if (!bd) return undefined;
  const x = (v: number) => `×${(Number.isFinite(v) ? v : 1).toFixed(2)}`;
  const factors = [
    `${t("game.training.fCond")} ${x(bd.eff?.condition ?? 1)}`,
    `${t("game.training.fAge")} ${x(bd.eff?.age ?? 1)}`,
    `${t("game.training.fQuality")} ${x(bd.eff?.quality ?? 1)}`,
    `${t("game.training.fCoach")} ${x(bd.eff?.coach ?? 1)}`,
    `${t("game.training.fFacility")} ${x(bd.eff?.facility ?? 1)}`,
  ].join(" · ");
  const pct = appliedPct ?? bd.finalPct ?? 0;
  return t("game.training.breakdown", { pct: pct.toFixed(1), factors });
}

function UsageChip({ label, used, limit }: { label?: string; used: number; limit: number }) {
  const { t } = useI18n();
  const reached = used >= limit;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs",
        reached
          ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
          : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      {label && <span>{label}</span>}
      <span className="font-mono tabular-nums">{t("game.training.usedTodayChip", { used, limit })}</span>
    </Badge>
  );
}

// ── Individual training card (one per specialization type) ──────

function SpecialTypeCard({
  type,
  players,
  playersLoading,
  used,
  limit,
  pending,
  canSpecial,
  onRun,
}: {
  type: TrainingSpecialType;
  players: PlayerRow[];
  playersLoading: boolean;
  used: number;
  limit: number;
  pending: boolean;
  canSpecial: boolean;
  onRun: (playerId: string) => void;
}) {
  const { t } = useI18n();
  const [playerId, setPlayerId] = React.useState("");
  const reached = limit > 0 && used >= limit;
  const Icon = TYPE_ICONS[type];
  const title = t(`game.training.spfocus.${type}`);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Icon aria-hidden="true" className="size-4 text-primary" />
            </span>
            <CardTitle className="truncate text-sm leading-tight">{title}</CardTitle>
          </div>
          <UsageChip used={used} limit={limit} />
        </div>
        <CardDescription className="text-xs leading-snug">
          {t(`game.training.spfocus.${type}.desc`)}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-1 flex-col gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`training-player-${type}`} className="text-xs text-muted-foreground">
            {t("game.training.eligible")}
          </Label>
          <Select value={playerId} onValueChange={setPlayerId} disabled={playersLoading || reached || !canSpecial}>
            <SelectTrigger
              id={`training-player-${type}`}
              aria-label={`${title} — ${t("game.training.pickPlayer")}`}
              className="min-h-11"
            >
              <SelectValue placeholder={t("game.training.pickPlayer")} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {players.map((p) => (
                <SelectItem key={p.id} value={p.id} className="py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <PositionBadge
                      pos={posGroupOf(p.detailedPos)}
                      label={p.detailedPos}
                      className="min-w-0 shrink-0 px-1"
                    />
                    <span className="truncate">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="ml-1 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {p.ovr}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {playersLoading && <Skeleton className="h-4 w-32" aria-hidden="true" />}
        </div>
        <Button
          className="mt-auto min-h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={!playerId || reached || pending || !canSpecial}
          onClick={() => onRun(playerId)}
        >
          <Play aria-hidden="true" className="mr-1.5 size-4" />
          {pending ? "…" : t("game.training.runSpecialShort")}
        </Button>
        {!canSpecial ? (
          <p className="text-center text-[11px] text-amber-300/90">{t("game.training.staffRequired")}</p>
        ) : reached ? (
          <p className="text-center text-[11px] text-amber-300/90">{t("game.training.usedToday")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function TrainingView() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const activeClubId = useViewStore((s) => s.activeClubId);

  const clubsQ = useQuery({ queryKey: qk.myClubs, queryFn: fetchMyClubs });
  const allClubs = clubsQ.data?.clubs ?? [];
  // Respect the top-bar club switcher (falls back to the first club).
  const club = allClubs.find((c) => c.id === activeClubId) ?? allClubs[0] ?? null;
  const clubId = club?.id ?? "";

  const query = useQuery({
    queryKey: qk.training(clubId),
    queryFn: () => fetchTraining(clubId),
    enabled: !!clubId,
  });
  const playersQ = useQuery({
    queryKey: qk.players(clubId),
    queryFn: () => fetchPlayers(clubId),
    enabled: !!clubId,
  });

  const [pendingType, setPendingType] = React.useState<TrainingSpecialType | null>(null);

  const errTitle = (err: unknown) => {
    const code = err instanceof ApiError ? err.code : "";
    return code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("err.generic");
  };

  const runGeneralMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ran: "general"; players: number; pct: number; attrsGained: number; breakdown?: TrainingBreakdown; finalPct?: number }>(
        "/api/training",
        {
          method: "POST",
          // Single general button: the server applies the default "balanced"
          // focus → every attribute of every squad player grows.
          body: { clubId, session: "general" },
        }
      ),
    onSuccess: (res) => {
      toast({
        title: t("game.training.ranGeneral", { players: res.players, pct: res.pct }),
        description: breakdownText(res.breakdown, res.finalPct, t),
      });
      // Attributes/fatigue changed → refresh usage + squad views.
      void queryClient.invalidateQueries({ queryKey: qk.training(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.players(clubId) });
    },
    onError: (err) => {
      toast({
        title: errTitle(err),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
  });

  const runSpecialMutation = useMutation({
    mutationFn: (vars: { type: TrainingSpecialType; playerId: string }) =>
      apiFetch<{
        ran: "special";
        type: TrainingSpecialType;
        playerId: string;
        pct: number;
        attrsGained: number;
        breakdown?: TrainingBreakdown;
        finalPct?: number;
      }>("/api/training", {
        method: "POST",
        body: { clubId, session: "special", specialType: vars.type, playerId: vars.playerId },
      }),
    onSuccess: (res) => {
      toast({
        title: t("game.training.ranSpecial", { pct: res.pct }),
        description: breakdownText(res.breakdown, res.finalPct, t),
      });
      void queryClient.invalidateQueries({ queryKey: qk.training(clubId) });
      void queryClient.invalidateQueries({ queryKey: qk.players(clubId) });
    },
    onError: (err) => {
      toast({
        title: errTitle(err),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    },
    onSettled: () => setPendingType(null),
  });

  const runSpecial = (type: TrainingSpecialType, playerId: string) => {
    setPendingType(type);
    runSpecialMutation.mutate({ type, playerId });
  };

  if (!club && clubsQ.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{t("game.training.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
      </div>
    );
  }

  const usage = query.data?.usage;

  const generalUsed = usage?.generalUsed ?? 0;
  const generalLimit = usage?.generalLimit ?? 0;
  const generalLimitReached = !!usage && generalUsed >= generalLimit;
  const players = playersQ.data?.players ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <CinemaHeader
        title={t("game.training.title")}
        subtitle={t("game.training.subtitle")}
        image="/images/training-dusk.jpg"
        icon={Dumbbell}
      />

      <Alert>
        <Info aria-hidden="true" className="size-4" />
        <AlertTitle>{t("game.training.limits")}</AlertTitle>
        <AlertDescription>{t("game.training.limitsDesc")}</AlertDescription>
      </Alert>

      {query.isLoading ? (
        <Skeleton className="h-72 w-full" aria-hidden="true" />
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-5">
          {/* ── General training: ONE button, whole squad, every attribute ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("game.training.general")}</CardTitle>
              <CardDescription>{t("game.training.generalDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <UsageChip used={generalUsed} limit={generalLimit} />
                    <Badge
                      variant="outline"
                      className="border-primary/30 bg-primary/5 text-xs text-primary"
                      aria-label={t("game.training.generalPctLabel")}
                    >
                      {t("game.training.generalPctLabel")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("game.training.runGeneralDesc", { limit: generalLimit })}
                  </p>
                </div>
                <Button
                  size="lg"
                  className="min-h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:px-8"
                  disabled={generalLimitReached || runGeneralMutation.isPending}
                  onClick={() => runGeneralMutation.mutate()}
                >
                  <Play aria-hidden="true" className="mr-1.5 size-4" />
                  {runGeneralMutation.isPending ? "…" : t("game.training.runGeneral")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Individual training: one card per type with its own player dropdown ──
              User mandate: special sessions REQUIRE technical staff (a coach);
              without one every card renders disabled + an honest hint. ── */}
          <section aria-labelledby="individual-heading" className="space-y-3">
            <div>
              <h2 id="individual-heading" className="text-base font-semibold">
                {t("game.training.individual")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("game.training.individualDesc")}</p>
            </div>
            {query.data?.canSpecial === false && (
              <Alert>
                <Info aria-hidden="true" className="size-4" />
                <AlertTitle>{t("game.training.staffRequiredTitle")}</AlertTitle>
                <AlertDescription>{t("game.training.staffRequiredDesc")}</AlertDescription>
              </Alert>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {SPECIAL_RUN_TYPES.map((type) => (
                <SpecialTypeCard
                  key={type}
                  type={type}
                  players={players}
                  playersLoading={playersQ.isLoading}
                  used={usage?.specialUsed[type] ?? 0}
                  limit={usage?.specialLimit ?? 0}
                  pending={pendingType === type}
                  canSpecial={query.data?.canSpecial ?? true}
                  onRun={(playerId) => runSpecial(type, playerId)}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
