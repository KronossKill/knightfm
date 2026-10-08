"use client";
// Knight FM — Dashboard "Command Center" (Task 55 élite redesign).
// Bento-box layout (Apple Sports / Linear grade): at-a-glance scanability in
// 3 seconds, with progressive disclosure — deep data stays one click away in
// drawers/dialogs (MatchDetailDialog) instead of polluting the main grid.
//
// Data contract is UNCHANGED from Task 4-a: same endpoints, same react-query
// keys, same polling intervals, same owner/manager role gating. Only the
// presentation layer is new:
//   · BentoCard — spring entrance (no bounce) + card-hover micro-interaction.
//   · RingGauge — animated SVG donut for squad readiness / league position.
//   · Next match — visual countdown in JetBrains Mono with a cyan live dot.
//   · Gold (--gold) is reserved for achievements: top-3 league position.
//   · Cyan (--info) is reserved for live signals: upcoming-kickoff chip.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Bot,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Landmark,
  Mail,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserCheck,
  Wallet,
} from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useViewStore } from "@/components/game/view-store";
import { apiFetch } from "@/components/auth/store";
import {
  fetchFixtures,
  fetchFacilities,
  fetchNotifications,
  fetchPlayers,
  fetchStandings,
  qk,
  type ClubMine,
  type FixtureRow,
} from "@/components/game/api";
import {
  BrandBadge,
  EmptyState,
  ErrorState,
  KV,
  formatCountdown,
  useNow,
} from "@/components/game/ui/bits";
import { MatchDetailDialog } from "@/components/game/competitions/match-dialog";

// ── Bento primitives (Task 55) ──────────────────────────────────

/**
 * Bento cell: spring entrance (critically damped — never bounces) plus the
 * shared `.card-hover` micro-interaction (2px lift + accent border glow).
 */
function BentoCard({
  className,
  index = 0,
  children,
}: {
  className?: string;
  index?: number;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 14, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 320, damping: 30, delay: Math.min(index * 0.045, 0.32) }
      }
      className={cn("card-hover flex flex-col rounded-xl border bg-card", className)}
    >
      {children}
    </motion.div>
  );
}

/** Vercel-style bento header: muted label row, optional right slot. */
function BentoHead({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
      <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="size-4 text-primary/80" />
        {title}
      </CardTitle>
      {right}
    </CardHeader>
  );
}

/**
 * RingGauge — circular progress (Task 55). SVG donut with an animated stroke
 * (one smooth ease-out, respects prefers-reduced-motion). Center value and
 * the label below always render in the precise mono face.
 */
function RingGauge({
  pct,
  value,
  label,
  tone = "var(--primary)",
  size = 96,
}: {
  /** 0-100 visual fill. */
  pct: number;
  value: string;
  label: string;
  tone?: string;
  size?: number;
}) {
  const reducedMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 40;
  const C = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 96 96" width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--muted)" strokeWidth="7" />
          <motion.circle
            cx="48"
            cy="48"
            r={r}
            fill="none"
            stroke={tone}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={reducedMotion ? { strokeDashoffset: C - (C * clamped) / 100 } : { strokeDashoffset: C }}
            animate={{ strokeDashoffset: C - (C * clamped) / 100 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-mono text-xl font-bold tabular-nums"
        >
          {value}
        </span>
      </div>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground" aria-hidden="true">
        {label}
      </span>
      <span className="sr-only">{`${label}: ${value}`}</span>
    </div>
  );
}

// ── Match cards ─────────────────────────────────────────────────

function ScoreLine({ fixture }: { fixture: FixtureRow }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <BrandBadge brand={fixture.home.brand} name={fixture.home.name} size="sm" />
        <span className="truncate text-sm">{fixture.home.name}</span>
      </div>
      <span className="shrink-0 font-mono text-2xl font-bold tabular-nums">
        {fixture.score ? `${fixture.score.home} – ${fixture.score.away}` : "– : –"}
      </span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2">
        <BrandBadge brand={fixture.away.brand} name={fixture.away.name} size="sm" />
        <span className="truncate text-sm">{fixture.away.name}</span>
      </div>
    </div>
  );
}

function PreviousMatchBento({ clubId, index }: { clubId: string; index: number }) {
  const { t, formatDate } = useI18n();
  const [dialogFixture, setDialogFixture] = React.useState<FixtureRow | null>(null);
  const query = useQuery({
    queryKey: ["fixtures", "prev", clubId],
    queryFn: () => fetchFixtures({ clubId, status: "PLAYED", limit: 10 }),
    refetchInterval: 120_000,
  });

  const played = (query.data?.fixtures ?? []).filter((f) => f.status === "PLAYED");
  const last = played[0] ?? null;

  return (
    <BentoCard index={index} className="xl:col-span-5">
      <BentoHead icon={ClipboardList} title={t("game.dash.lastMatch")} />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {query.isLoading ? (
          <Skeleton className="h-14 w-full" aria-hidden="true" />
        ) : query.isError ? (
          <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} className="py-6" />
        ) : !last ? (
          <EmptyState title={t("game.dash.noLastMatch")} className="py-6" icon={ClipboardList} />
        ) : (
          <div className="space-y-2.5">
            <ScoreLine fixture={last} />
            <p className="text-[11px] text-muted-foreground">
              {t(`comp.${last.competition}`)}
              {last.matchDay ? ` · ${t("fixtures.matchday", { n: last.matchDay })}` : ""} · {formatDate(last.kickoffUtc)}
            </p>
            <Button variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => setDialogFixture(last)}>
              <ArrowRight aria-hidden="true" className="mr-1 size-4" />
              {t("game.dash.viewMatch")}
            </Button>
          </div>
        )}
        <MatchDetailDialog fixture={dialogFixture} open={!!dialogFixture} onOpenChange={(v) => !v && setDialogFixture(null)} />
      </CardContent>
    </BentoCard>
  );
}

/** Neutral monogram badge for opponents without a brand payload (Task 55). */
function OpponentMonogram({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 font-mono text-[11px] font-bold text-muted-foreground"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function NextMatchBento({ club, index }: { club: ClubMine; index: number }) {
  const { t, formatDate } = useI18n();
  const nowMs = useNow(1000);
  const fx = club.nextFixture;
  const hydrated = nowMs > 0;
  const future = fx ? new Date(fx.kickoffUtc).getTime() - nowMs : 0;
  const live = !!fx && hydrated && future <= 0;

  return (
    <BentoCard
      index={index}
      className="relative isolate overflow-hidden border-primary/20 xl:col-span-7"
    >
      {fx && (
        <>
          {/* Task 56 — photoreal stadium backdrop (decorative, theme-veiled). */}
              <img
            src="/images/stadium-night.jpg"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 -z-10 size-full scale-[1.02] object-cover opacity-35 saturate-[0.8]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-card/85 via-card/55 to-card"
          />
        </>
      )}
      <BentoHead
        icon={CalendarDays}
        title={t("game.dash.nextMatch")}
        right={
          fx ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                live ? "border-primary/40 bg-primary/10 text-primary" : "border-info/30 bg-info/10 text-info"
              )}
            >
              {!live ? <span className="live-dot" aria-hidden="true" /> : null}
              {t(`comp.${fx.competition}`)}
            </span>
          ) : undefined
        }
      />
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        {!fx ? (
          <EmptyState title={t("game.dash.noNextMatch")} className="py-6" icon={CalendarDays} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <BrandBadge brand={club.brand} name={club.name} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-semibold leading-tight">
                  <span className="truncate">{club.name}</span>
                  <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">
                    {fx.isHome ? "vs" : "@"}
                  </span>
                  <span className="truncate">{fx.opponentName}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 text-[10px]",
                      fx.isHome ? "border-primary/40 text-primary" : "border-amber-500/40 text-amber-300"
                    )}
                  >
                    {fx.isHome ? t("game.dash.home") : t("game.dash.away")}
                  </Badge>
                  <span className="truncate">
                    {t("game.dash.opponent")}: {fx.opponentName}
                  </span>
                </p>
              </div>
              <OpponentMonogram name={fx.opponentName} />
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-background/60 px-4 py-3 backdrop-blur-sm",
                live ? "border-primary/30" : "border-border/70"
              )}
            >
              <span className="text-xs text-muted-foreground">{t("game.dash.kickoffIn")}</span>
              {hydrated && future > 0 ? (
                <span
                  className="font-mono text-3xl font-bold tracking-tight tabular-nums text-primary sm:text-4xl"
                  aria-live="off"
                >
                  {formatCountdown(new Date(fx.kickoffUtc).getTime(), nowMs)}
                </span>
              ) : (
                <span className="font-mono text-lg font-semibold text-primary">{t("game.dash.kickedOff")}</span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t(`comp.${fx.competition}`)}
              {fx.round ? ` · ${fx.round}` : ""} · {formatDate(fx.kickoffUtc)}
            </p>
          </>
        )}
      </CardContent>
    </BentoCard>
  );
}

// ── Manager-only bentos ─────────────────────────────────────────

function ReadinessBento({ club, index }: { club: ClubMine; index: number }) {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const tacticsQ = useQuery({
    queryKey: ["tactics", club.id],
    queryFn: () =>
      apiFetch<{
        formation: string;
        availability: { total: number; available: number; injured: number; suspended: number };
      }>(`/api/tactics?clubId=${encodeURIComponent(club.id)}`),
  });
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const fatigued = players.filter((p) => p.fatigue > 70).length;
  const avgFatigue = players.length > 0 ? players.reduce((a, p) => a + p.fatigue, 0) / players.length : 0;
  const avail = tacticsQ.data?.availability;
  const lineupPct = avail && avail.total > 0 ? Math.round((avail.available / avail.total) * 100) : null;

  return (
    <BentoCard index={index} className="xl:col-span-4">
      <BentoHead
        icon={Dumbbell}
        title={t("game.dash.readiness")}
        right={
          <button
            type="button"
            onClick={() => setView("tactics")}
            className="flex min-h-9 items-center gap-1 rounded-md px-1.5 font-mono text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`${t("game.dash.formation")}: ${tacticsQ.data?.formation ?? "—"} — ${t("game.nav.tactics")}`}
          >
            {tacticsQ.data?.formation ?? "—"}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        }
      />
      <CardContent className="flex flex-1 flex-col gap-4">
        {tacticsQ.isLoading || playersQ.isLoading ? (
          <>
            <Skeleton className="h-20 w-full" aria-hidden="true" />
            <Skeleton className="h-4 w-2/3" aria-hidden="true" />
          </>
        ) : (
          <>
            {lineupPct !== null && avail && (
              <div className="flex items-center justify-around gap-2">
                <RingGauge
                  pct={lineupPct}
                  value={`${Math.round((avail.available / avail.total) * 100)}%`}
                  label={t("game.dash.lineup")}
                  tone="var(--primary)"
                  size={86}
                />
                <RingGauge
                  pct={avgFatigue}
                  value={String(Math.round(avgFatigue))}
                  label={t("game.dash.ring.fatigue")}
                  tone={avgFatigue > 70 ? "#f59e0b" : "var(--primary)"}
                  size={86}
                />
              </div>
            )}
            <Separator />
            <div className="space-y-1.5" aria-label={t("game.dash.squadFitness")}>
              {players.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("game.squad.empty")}</p>
              ) : (
                <>
                  <WarningLine ok={fatigued === 0} text={t("game.dash.fatigueWarning", { n: fatigued })} />
                  <WarningLine ok={(avail?.injured ?? 0) === 0} text={t("game.dash.injuredWarning", { n: avail?.injured ?? 0 })} />
                  <WarningLine ok={(avail?.suspended ?? 0) === 0} text={t("game.dash.suspendedWarning", { n: avail?.suspended ?? 0 })} />
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </BentoCard>
  );
}

function WarningLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <UserCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
      ) : (
        <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-amber-400" />
      )}
      <span className={ok ? "text-xs text-muted-foreground" : "text-amber-200"}>{text}</span>
    </div>
  );
}

function InboxBento({ index }: { index: number }) {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const query = useQuery({ queryKey: qk.notifications, queryFn: fetchNotifications, refetchInterval: 60_000 });
  const items = query.data?.items ?? [];

  return (
    <BentoCard index={index} className="xl:col-span-3">
      <BentoHead icon={Mail} title={t("game.dash.inboxPreview")} />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" aria-hidden="true" />
        ) : items.length === 0 ? (
          <EmptyState title={t("common.empty")} className="py-6" icon={Mail} />
        ) : (
          <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {items.slice(0, 5).map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm transition-colors hover:bg-accent/60"
              >
                {!n.readAt && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{n.typeKey}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="sm" className="min-h-11 w-full justify-center" onClick={() => setView("inbox")}>
            <Mail aria-hidden="true" className="mr-1 size-4" />
            {t("game.nav.inbox")}
          </Button>
          <Button
            size="sm"
            className="min-h-11 w-full justify-center bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setView("assistant")}
          >
            <Bot aria-hidden="true" className="mr-1 size-4" />
            {t("game.dash.askAssistant")}
          </Button>
        </div>
      </CardContent>
    </BentoCard>
  );
}

/** League-position bento: ring + stat grid. Gold ring = top-3 (achievement). */
function StandingsBento({ club, index }: { club: ClubMine; index: number }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: qk.standings(club.divisionId),
    queryFn: () => fetchStandings(club.divisionId),
    enabled: !!club.divisionId,
  });
  const rows = query.data?.standings ?? [];
  const mine = rows.find((r) => r.club.id === club.id) ?? null;
  const total = rows.length || 16;
  const fillPct = mine ? Math.round(((total - mine.position + 1) / total) * 100) : 0;
  const isTop3 = !!mine && mine.position <= 3;

  return (
    <BentoCard index={index} className="xl:col-span-5">
      <BentoHead
        icon={Trophy}
        title={t("game.dash.standings")}
        right={
          <span className="truncate text-[11px] text-muted-foreground">
            {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
          </span>
        }
      />
      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" aria-hidden="true" />
        ) : !mine ? (
          <EmptyState title={t("game.comp.noStandings")} className="py-6" icon={Trophy} />
        ) : (
          <>
            <RingGauge
              pct={fillPct}
              value={String(mine.position)}
              label={t("game.dash.position")}
              tone={isTop3 ? "var(--gold)" : "var(--primary)"}
              size={104}
            />
            <div className="grid w-full grid-cols-4 gap-2 text-center">
              <KV label={t("standings.played")} className="items-center">
                <span className="font-mono text-lg font-semibold tabular-nums">{mine.played}</span>
              </KV>
              <KV label={t("standings.points")} className="items-center">
                <span className="font-mono text-lg font-semibold tabular-nums">{mine.points}</span>
              </KV>
              <KV label={t("standings.gf")} className="items-center">
                <span className="font-mono text-lg font-semibold tabular-nums">{mine.gf}</span>
              </KV>
              <KV label={t("standings.ga")} className="items-center">
                <span className="font-mono text-lg font-semibold tabular-nums">{mine.ga}</span>
              </KV>
            </div>
          </>
        )}
      </CardContent>
    </BentoCard>
  );
}

// ── Owner-only bentos ───────────────────────────────────────────

const FIN_TONE: Record<string, string> = {
  HEALTHY: "border-primary/40 text-primary",
  INSOLVENT: "border-amber-500/40 text-amber-300",
  POSSIBLE_BANKRUPTCY: "border-amber-500/40 text-amber-300",
  BANKRUPT: "border-destructive/40 text-destructive",
};

function FinanceBento({ club, index }: { club: ClubMine; index: number }) {
  const { t, formatCurrency } = useI18n();
  const setView = useViewStore((s) => s.setView);
  return (
    <BentoCard index={index} className="xl:col-span-4">
      <BentoHead
        icon={Wallet}
        title={t("game.dash.finance")}
        right={
          <Badge variant="outline" className={FIN_TONE[club.finState] ?? ""}>
            {t(`game.dash.fin.${club.finState}`)}
          </Badge>
        }
      />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <div className="grid grid-cols-2 gap-3">
          <KV label={t("game.dash.fund")}>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(club.operatingFund)}</span>
          </KV>
          <KV label={t("game.dash.debt")}>
            <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(club.debt)}</span>
          </KV>
        </div>
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("treasury")}>
          <Landmark aria-hidden="true" className="mr-1 size-4" />
          {t("game.nav.treasury")}
        </Button>
      </CardContent>
    </BentoCard>
  );
}

function SquadSummaryBento({ club, index }: { club: ClubMine; index: number }) {
  const { t, formatCurrency } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const avgOvr = players.length > 0 ? Math.round(players.reduce((a, p) => a + p.ovr, 0) / players.length) : null;
  const totalValue = players.reduce((a, p) => a + p.marketValue, 0);

  return (
    <BentoCard index={index} className="xl:col-span-4">
      <BentoHead icon={TrendingUp} title={t("game.dash.squadSummary")} />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {playersQ.isLoading ? (
          <Skeleton className="h-12 w-full" aria-hidden="true" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <KV label={t("game.dash.players")}>
              <span className="font-mono text-lg font-semibold tabular-nums">
                {club.playerCount}/{club.capacity.finalCapacity}
              </span>
            </KV>
            <KV label={t("game.dash.avgOvr")}>
              <span className="font-mono text-lg font-semibold tabular-nums">{avgOvr ?? "—"}</span>
            </KV>
            <KV label={t("game.squad.value")}>
              <span className="font-mono text-lg font-semibold tabular-nums">{formatCurrency(totalValue)}</span>
            </KV>
          </div>
        )}
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("squad")}>
          {t("game.nav.squad")}
          <ArrowRight aria-hidden="true" className="ml-1 size-4" />
        </Button>
      </CardContent>
    </BentoCard>
  );
}

function FacilitiesBento({ club, index }: { club: ClubMine; index: number }) {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const query = useQuery({ queryKey: qk.facilities(club.id), queryFn: () => fetchFacilities(club.id) });
  const facilities = query.data?.facilities ?? [];

  return (
    <BentoCard index={index} className="xl:col-span-4">
      <BentoHead icon={Banknote} title={t("game.dash.facilitiesProgress")} />
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" aria-hidden="true" />
        ) : facilities.length === 0 ? (
          <EmptyState title={t("common.empty")} className="py-6" />
        ) : (
          <ul className="space-y-2">
            {facilities.map((f) => (
              <li key={f.type} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{t(`facility.${f.type}`)}</span>
                <Progress
                  value={(f.level / 10) * 100}
                  className="h-1.5"
                  aria-label={`${t(`facility.${f.type}`)} ${t("facility.level", { level: f.level })}`}
                />
                <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                  {f.level}/10
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("facilities")}>
          {t("game.nav.facilities")}
          <ArrowRight aria-hidden="true" className="ml-1 size-4" />
        </Button>
      </CardContent>
    </BentoCard>
  );
}

// ── Shared bottom row ───────────────────────────────────────────

function CalendarBento({ clubId, index }: { clubId: string; index: number }) {
  const { t, formatDate } = useI18n();
  const query = useQuery({
    queryKey: ["fixtures", "next5", clubId],
    queryFn: () => fetchFixtures({ clubId, limit: 30 }),
    refetchInterval: 120_000,
  });
  const fixtures = (query.data?.fixtures ?? []).filter((f) => f.status === "SCHEDULED").slice(0, 5);

  return (
    <BentoCard index={index} className="xl:col-span-7">
      <BentoHead icon={CalendarDays} title={t("game.dash.calendar")} />
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" aria-hidden="true" />
        ) : fixtures.length === 0 ? (
          <EmptyState title={t("game.dash.noNextMatch")} className="py-6" icon={CalendarDays} />
        ) : (
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {fixtures.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm transition-colors hover:bg-accent/60"
              >
                <Badge variant="outline" className="shrink-0 border-primary/30 text-[10px]">
                  {t(`comp.${f.competition}`)}
                </Badge>
                <span className="min-w-0 flex-1 truncate">
                  {f.home.id === clubId ? f.away.name : f.home.name}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({f.home.id === clubId ? t("game.dash.home") : t("game.dash.away")})
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatDate(f.kickoffUtc)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </BentoCard>
  );
}

function TreasuryBento({ club, index }: { club: ClubMine; index: number }) {
  const { t, formatCurrency } = useI18n();
  return (
    <BentoCard index={index} className="xl:col-span-5">
      <BentoHead icon={Landmark} title={t("game.nav.treasury")} />
      <CardContent className="flex flex-1 flex-col justify-center gap-2">
        <p className="text-sm text-muted-foreground">{t("game.dash.treasuryNote")}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-muted/50 px-2 py-1">
            {t("game.dash.fund")}: <span className="font-mono tabular-nums">{formatCurrency(club.operatingFund)}</span>
          </span>
          <span className="rounded-md bg-muted/50 px-2 py-1">
            {t("game.dash.debt")}: <span className="font-mono tabular-nums">{formatCurrency(club.debt)}</span>
          </span>
        </div>
      </CardContent>
    </BentoCard>
  );
}

// ── Main view ───────────────────────────────────────────────────

export default function DashboardView({ clubs }: { clubs: ClubMine[] }) {
  const { t } = useI18n();
  const activeClubId = useViewStore((s) => s.activeClubId);
  const club = clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;

  if (!club) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-semibold">{t("game.dash.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
      </div>
    );
  }

  const isOwner = club.role === "OWNER";

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Command-center header */}
      <header className="flex flex-wrap items-center gap-3">
        <BrandBadge brand={club.brand} name={club.name} size="lg" />
        <div className="min-w-0">
          <h1 className="text-luminous truncate text-2xl font-semibold leading-tight tracking-tight">
            {isOwner ? t("game.dash.titleOwner") : t("game.dash.title")}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {club.name} · {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex} — {t("game.dash.subtitle")}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
          {isOwner ? t("role.owner") : t("role.manager")}
        </Badge>
      </header>

      {/* Bento grid (Task 55): 2 columns on lg, 12 columns on xl, stacked below. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <NextMatchBento club={club} index={0} />
        {isOwner ? (
          <>
            <PreviousMatchBento clubId={club.id} index={1} />
            <FinanceBento club={club} index={2} />
            <SquadSummaryBento club={club} index={3} />
            <FacilitiesBento club={club} index={4} />
          </>
        ) : (
          <>
            <StandingsBento club={club} index={1} />
            <PreviousMatchBento clubId={club.id} index={2} />
            <ReadinessBento club={club} index={3} />
            <InboxBento index={4} />
          </>
        )}
        <CalendarBento clubId={club.id} index={5} />
        <TreasuryBento club={club} index={6} />
      </div>
    </div>
  );
}
