"use client";
// Knight FM — dashboard widget content library (Task 32 — Master UI/UX).
// Every widget is an independent card that fetches its own data (skeleton
// states while loading) and exposes at least one primary action. Content is
// dense but glanceable (<3s), keyboard accessible and token-styled.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
  Bot,
  Building2,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Globe2,
  Handshake,
  Landmark,
  Mail,
  ShieldAlert,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useViewStore } from "@/components/game/view-store";
import { apiFetch } from "@/components/auth/store";
import {
  fetchFacilities,
  fetchFixtures,
  fetchNotifications,
  fetchPlayers,
  fetchStandings,
  fetchTraining,
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
  formatUtcClock,
  useNow,
} from "@/components/game/ui/bits";
import { MatchDetailDialog } from "@/components/game/competitions/match-dialog";

export interface WidgetContentProps {
  club: ClubMine;
  clubs: ClubMine[];
}

function WidgetCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex h-full flex-col overflow-hidden", className)}>
      <CardHeader className="shrink-0 space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-brand" />
          <span className="truncate">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 pt-0">{children}</CardContent>
    </Card>
  );
}

// ── Previous match (2×1) ────────────────────────────────────────

function ScoreLine({ fixture }: { fixture: FixtureRow }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <BrandBadge brand={fixture.home.brand} name={fixture.home.name} size="sm" />
        <span className="truncate text-sm">{fixture.home.name}</span>
      </div>
      <span className="shrink-0 font-mono text-lg font-bold tabular-nums">
        {fixture.score ? `${fixture.score.home} – ${fixture.score.away}` : "– : –"}
      </span>
      <div className="flex min-w-0 flex-row-reverse items-center gap-2">
        <BrandBadge brand={fixture.away.brand} name={fixture.away.name} size="sm" />
        <span className="truncate text-sm">{fixture.away.name}</span>
      </div>
    </div>
  );
}

export function PreviousMatchWidget({ club }: WidgetContentProps) {
  const { t, formatDate } = useI18n();
  const [dialogFixture, setDialogFixture] = React.useState<FixtureRow | null>(null);
  const query = useQuery({
    queryKey: ["fixtures", "prev", club.id],
    queryFn: () => fetchFixtures({ clubId: club.id, status: "PLAYED", limit: 10 }),
    refetchInterval: 120_000,
  });
  const last = (query.data?.fixtures ?? []).filter((f) => f.status === "PLAYED")[0] ?? null;

  return (
    <>
      <WidgetCard title={t("game.dash.lastMatch")} icon={ClipboardList}>
        {query.isLoading ? (
          <Skeleton className="h-14 w-full" aria-hidden="true" />
        ) : query.isError ? (
          <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} className="py-4" />
        ) : !last ? (
          <EmptyState title={t("game.dash.noLastMatch")} className="py-4" icon={ClipboardList} />
        ) : (
          <div className="space-y-2.5">
            <ScoreLine fixture={last} />
            <p className="text-[11px] text-muted-foreground">
              {t(`comp.${last.competition}`)}
              {last.matchDay ? ` · ${t("fixtures.matchday", { n: last.matchDay })}` : ""} · {formatDate(last.kickoffUtc)}
            </p>
            <Button variant="outline" size="sm" className="min-h-9 w-full sm:w-auto" onClick={() => setDialogFixture(last)}>
              <ArrowRight aria-hidden="true" className="mr-1 size-4" />
              {t("game.dash.viewMatch")}
            </Button>
          </div>
        )}
      </WidgetCard>
      <MatchDetailDialog fixture={dialogFixture} open={!!dialogFixture} onOpenChange={(v) => !v && setDialogFixture(null)} />
    </>
  );
}

// ── Next match (2×1) ────────────────────────────────────────────

export function NextMatchWidget({ club }: WidgetContentProps) {
  const { t, formatDate } = useI18n();
  const nowMs = useNow(1000);
  const fx = club.nextFixture;

  return (
    <WidgetCard title={t("game.dash.nextMatch")} icon={CalendarDays} className="border-brand/25">
      {!fx ? (
        <EmptyState title={t("game.dash.noNextMatch")} className="py-4" icon={CalendarDays} />
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className={cn("border-brand/40 text-brand-soft", !fx.isHome && "border-warning/40 text-warning")}>
                {fx.isHome ? t("game.dash.home") : t("game.dash.away")}
              </Badge>
              <span className="text-xs text-muted-foreground">{t("game.dash.opponent")}</span>
            </div>
            <span className="truncate text-sm font-semibold">{fx.opponentName}</span>
          </div>
          <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t("game.dash.kickoffIn")}</span>
            <span className="font-mono text-lg font-bold tabular-nums text-brand-soft">
              {nowMs > 0 && new Date(fx.kickoffUtc).getTime() > nowMs
                ? formatCountdown(new Date(fx.kickoffUtc).getTime(), nowMs)
                : t("game.dash.kickedOff")}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {t(`comp.${fx.competition}`)}
            {fx.round ? ` · ${fx.round}` : ""} · {formatDate(fx.kickoffUtc)}
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

// ── World clock (1×1) ───────────────────────────────────────────

export function WorldClockWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const nowMs = useNow(1000);
  const { data } = useQuery({ queryKey: qk.world, queryFn: () => import("@/components/game/api").then((m) => m.fetchWorldState()), refetchInterval: 60_000 });
  const hydrated = nowMs > 0;
  const season = data?.season ?? null;
  const fx = club.nextFixture;
  const kickoff = fx ? new Date(fx.kickoffUtc).getTime() : 0;

  return (
    <WidgetCard title={t("game.dash.w.worldClock")} icon={Globe2}>
      <div className="flex h-full flex-col justify-between gap-2">
        <div>
          <p className="font-mono text-2xl font-bold tabular-nums leading-none">
            {hydrated ? formatUtcClock(nowMs) : "--:--:--"}
            <span className="ml-1 align-middle text-[10px] font-normal text-muted-foreground">UTC</span>
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("world.gameDay")} {data?.gameDay ?? "—"}
            {season
              ? season.preseasonDay !== undefined
                ? ` · ${t("world.preseasonDay", { day: season.preseasonDay })}`
                : ` · ${t("world.seasonDay", { day: season.seasonDay ?? 0 })}`
              : ""}
          </p>
        </div>
        {fx && (
          <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.nextMatch")}</p>
            <p className="truncate text-xs font-medium">{fx.opponentName}</p>
            <p className="font-mono text-xs tabular-nums text-brand-soft">
              {hydrated && kickoff > nowMs ? formatCountdown(kickoff, nowMs) : t("game.dash.kickedOff")}
            </p>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}

// ── Tactical readiness (1×1, manager) ───────────────────────────

function WarningLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <UserCheck aria-hidden="true" className="size-3.5 shrink-0 text-brand" />
      ) : (
        <ShieldAlert aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
      )}
      <span className={ok ? "text-xs text-muted-foreground" : "text-xs text-warning"}>{text}</span>
    </div>
  );
}

export function ReadinessWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const tacticsQ = useQuery({
    queryKey: ["tactics", club.id],
    queryFn: () =>
      apiFetch<{ formation: string; availability: { total: number; available: number; injured: number; suspended: number } }>(
        `/api/tactics?clubId=${encodeURIComponent(club.id)}`
      ),
  });
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const fatigued = players.filter((p) => p.fatigue > 70).length;
  const avail = tacticsQ.data?.availability;
  const lineupPct = avail && avail.total > 0 ? Math.round((avail.available / avail.total) * 100) : null;

  return (
    <WidgetCard title={t("game.dash.readiness")} icon={Dumbbell}>
      {tacticsQ.isLoading || playersQ.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setSection("tactics")}
            className="flex w-full items-center justify-between rounded-md px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-xs text-muted-foreground">{t("game.dash.formation")}</span>
            <span className="flex items-center gap-1 font-mono text-base font-semibold text-brand-soft">
              {tacticsQ.data?.formation ?? "—"}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </span>
          </button>
          {lineupPct !== null && <Progress value={lineupPct} className="h-1.5" aria-label={`${t("game.dash.lineup")}: ${lineupPct}%`} />}
          <WarningLine ok={fatigued === 0} text={t("game.dash.fatigueWarning", { n: fatigued })} />
          <WarningLine ok={(avail?.injured ?? 0) === 0} text={t("game.dash.injuredWarning", { n: avail?.injured ?? 0 })} />
          <WarningLine ok={(avail?.suspended ?? 0) === 0} text={t("game.dash.suspendedWarning", { n: avail?.suspended ?? 0 })} />
        </div>
      )}
    </WidgetCard>
  );
}

// ── Squad status (1×1, manager) ─────────────────────────────────

export function SquadStatusWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const injured = players.filter((p) => p.injuredUntil && new Date(p.injuredUntil).getTime() > Date.now()).length;
  const suspended = players.filter((p) => p.suspension > 0).length;
  const avgMorale = players.length ? Math.round(players.reduce((a, p) => a + p.morale, 0) / players.length) : null;

  return (
    <WidgetCard title={t("game.dash.w.squadStatus")} icon={Users}>
      {playersQ.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : (
        <div className="flex h-full flex-col justify-between gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Badge variant="outline" className={cn("justify-center", injured > 0 ? "border-warning/40 text-warning" : "text-muted-foreground")}>
              {t("player.injuredShort", { n: injured })}
            </Badge>
            <Badge variant="outline" className={cn("justify-center", suspended > 0 ? "border-destructive/40 text-destructive" : "text-muted-foreground")}>
              {t("player.suspendedShort", { n: suspended })}
            </Badge>
          </div>
          {avgMorale !== null && (
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("player.morale")}</span>
                <span className="font-mono tabular-nums">{avgMorale}%</span>
              </div>
              <Progress value={avgMorale} className="h-1.5" aria-label={`${t("player.morale")}: ${avgMorale}%`} />
            </div>
          )}
          <Button variant="ghost" size="sm" className="min-h-9 w-full justify-between px-2" onClick={() => setSection("squad")}>
            {t("game.nav.sub.players")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}

// ── Training plan (1×1, manager) ────────────────────────────────

export function TrainingPlanWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const query = useQuery({ queryKey: qk.training(club.id), queryFn: () => fetchTraining(club.id) });

  return (
    <WidgetCard title={t("game.dash.w.trainingPlan")} icon={Dumbbell}>
      {query.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} className="py-4" />
      ) : (
        <div className="flex h-full flex-col justify-between gap-2">
          <div className="space-y-1">
            <KV label={t("game.training.general")}>{query.data ? t(`game.training.focus.${query.data.plan.generalFocus}`) : "—"}</KV>
            <KV label={t("game.training.special")}>{query.data ? t(`game.training.spfocus.${query.data.plan.specialFocus}`) : "—"}</KV>
          </div>
          <Button variant="ghost" size="sm" className="min-h-9 w-full justify-between px-2" onClick={() => setSection("training")}>
            {t("game.nav.section.training")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}

// ── Inbox (1×1) ─────────────────────────────────────────────────

export function InboxWidget() {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const query = useQuery({ queryKey: qk.notifications, queryFn: fetchNotifications, refetchInterval: 60_000 });
  const items = query.data?.items ?? [];
  const unread = query.data?.unread ?? 0;

  return (
    <WidgetCard title={t("game.dash.inboxPreview")} icon={Mail}>
      {query.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : items.length === 0 ? (
        <EmptyState title={t("common.empty")} className="py-4" icon={Mail} />
      ) : (
        <>
          <ul className="space-y-1">
            {items.slice(0, 3).map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
                {!n.readAt && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand" />}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{n.typeKey}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("game.shell.unread", { n: unread })}
          </p>
        </>
      )}
      <div className="mt-2 flex gap-2">
        <Button variant="outline" size="sm" className="min-h-9 flex-1" onClick={() => setView("inbox")}>
          <Mail aria-hidden="true" className="mr-1 size-3.5" />
          {t("game.nav.inbox")}
        </Button>
        <Button size="sm" className="min-h-9 flex-1 bg-brand-deep text-white hover:bg-brand" onClick={() => setView("assistant")}>
          <Bot aria-hidden="true" className="mr-1 size-3.5" />
          {t("game.dash.askAssistant")}
        </Button>
      </div>
    </WidgetCard>
  );
}

// ── Standings snapshot (1×2) ────────────────────────────────────

export function StandingsWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const query = useQuery({
    queryKey: qk.standings(club.divisionId),
    queryFn: () => fetchStandings(club.divisionId),
    enabled: !!club.divisionId,
  });
  const rows = query.data?.standings ?? [];
  const top = rows.slice(0, 6);
  const mine = rows.find((r) => r.club.id === club.id) ?? null;
  const mineOutside = mine && !top.some((r) => r.club.id === club.id);

  return (
    <WidgetCard title={t("game.dash.standings")} icon={Trophy}>
      {query.isLoading ? (
        <Skeleton className="h-24 w-full" aria-hidden="true" />
      ) : rows.length === 0 ? (
        <EmptyState title={t("game.comp.noStandings")} className="py-4" icon={Trophy} />
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="w-6 py-0.5 font-medium">#</th>
                <th className="py-0.5 font-medium">{t("standings.club")}</th>
                <th className="w-8 py-0.5 text-right font-medium">{t("standings.played")}</th>
                <th className="w-10 py-0.5 text-right font-medium">{t("standings.points")}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => (
                <tr key={r.club.id} className={cn("border-t border-border/50", r.club.id === club.id && "bg-brand/10 font-medium text-brand-soft")}>
                  <td className="py-1 tabular-nums">{r.position}</td>
                  <td className="truncate py-1">{r.club.name}</td>
                  <td className="py-1 text-right tabular-nums">{r.played}</td>
                  <td className="py-1 text-right tabular-nums">{r.points}</td>
                </tr>
              ))}
              {mineOutside && mine && (
                <tr className="border-t border-border/50 bg-brand/10 font-medium text-brand-soft">
                  <td className="py-1 tabular-nums">{mine.position}</td>
                  <td className="truncate py-1">{mine.club.name}</td>
                  <td className="py-1 text-right tabular-nums">{mine.played}</td>
                  <td className="py-1 text-right tabular-nums">{mine.points}</td>
                </tr>
              )}
            </tbody>
          </table>
          <Button variant="ghost" size="sm" className="min-h-9 w-full justify-between px-2" onClick={() => setSection("competitions")}>
            {t("game.nav.section.competitions")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}

// ── Top performers (1×1, manager) ───────────────────────────────

export function TopPerformersWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = [...(playersQ.data?.players ?? [])].sort((a, b) => b.form - a.form || b.ovr - a.ovr).slice(0, 3);

  return (
    <WidgetCard title={t("game.dash.w.topPerformers")} icon={TrendingUp}>
      {playersQ.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : players.length === 0 ? (
        <EmptyState title={t("game.squad.empty")} className="py-4" icon={Users} />
      ) : (
        <ul className="space-y-1">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{p.firstName} {p.lastName}</span>
              <span className="shrink-0 font-mono tabular-nums text-brand-soft">{p.form}%</span>
              <span className="shrink-0 text-muted-foreground">OVR {p.ovr}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ── Market pulse — scouting substitute (1×1) ────────────────────

export function MarketPulseWidget() {
  const { t, formatCurrency } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const nowMs = useNow(30_000);
  const query = useQuery({
    queryKey: ["dashboard", "auctions"],
    queryFn: () => apiFetch<{ items: { listingId: string; player: { firstName: string; lastName: string } | null; currentHighest: number | null; expiresAt: string }[] }>("/api/markets/auctions"),
    refetchInterval: 120_000,
  });
  const items = [...(query.data?.items ?? [])]
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, 3);

  return (
    <WidgetCard title={t("game.dash.w.marketPulse")} icon={Handshake}>
      {query.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : items.length === 0 ? (
        <EmptyState title={t("game.dash.w.noMarket")} className="py-4" icon={Handshake} />
      ) : (
        <ul className="space-y-1">
          {items.map((a) => (
            <li key={a.listingId} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate">{a.player ? `${a.player.firstName} ${a.player.lastName}` : "—"}</span>
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {a.currentHighest !== null ? formatCurrency(a.currentHighest) : "—"}
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-brand-soft">
                {nowMs > 0 ? formatCountdown(new Date(a.expiresAt).getTime(), nowMs) : "…"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-2 min-h-9 w-full justify-between px-2" onClick={() => setSection("recruitment", "auctions")}>
        {t("markets.auctions")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </WidgetCard>
  );
}

// ── Club finance (2×1, owner) ───────────────────────────────────

const FIN_TONE: Record<string, string> = {
  HEALTHY: "border-brand/40 text-brand-soft",
  INSOLVENT: "border-warning/40 text-warning",
  POSSIBLE_BANKRUPTCY: "border-warning/40 text-warning",
  BANKRUPT: "border-destructive/40 text-destructive",
};

export function FinanceWidget({ club }: WidgetContentProps) {
  const { t, formatCurrency } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  return (
    <WidgetCard title={t("game.dash.finance")} icon={Wallet}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <KV label={t("game.dash.fund")}>{formatCurrency(club.operatingFund)}</KV>
          <KV label={t("game.dash.debt")}>{formatCurrency(club.debt)}</KV>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("game.dash.finState")}</span>
          <Badge variant="outline" className={FIN_TONE[club.finState] ?? ""}>
            {t(`game.dash.fin.${club.finState}`)}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="min-h-9 w-full" onClick={() => setSection("club", "finances")}>
          <Landmark aria-hidden="true" className="mr-1 size-4" />
          {t("game.nav.sub.finances")}
        </Button>
      </div>
    </WidgetCard>
  );
}

// ── Squad overview (2×1, owner) ─────────────────────────────────

export function SquadOverviewWidget({ club }: WidgetContentProps) {
  const { t, formatCurrency } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const avgOvr = players.length ? Math.round(players.reduce((a, p) => a + p.ovr, 0) / players.length) : null;
  const totalValue = players.reduce((a, p) => a + p.marketValue, 0);
  const totalSalary = players.reduce((a, p) => a + p.salary, 0);

  return (
    <WidgetCard title={t("game.dash.squadSummary")} icon={TrendingUp}>
      {playersQ.isLoading ? (
        <Skeleton className="h-12 w-full" aria-hidden="true" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KV label={t("game.dash.players")}>{club.playerCount}/{club.capacity.finalCapacity}</KV>
          <KV label={t("game.dash.avgOvr")}>{avgOvr ?? "—"}</KV>
          <KV label={t("game.squad.value")}>{formatCurrency(totalValue)}</KV>
          <KV label={t("game.dash.w.salaries")}>{formatCurrency(totalSalary)}</KV>
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-3 min-h-9 w-full sm:w-auto" onClick={() => setSection("squad")}>
        {t("game.nav.section.squad")}
        <ArrowRight aria-hidden="true" className="ml-1 size-4" />
      </Button>
    </WidgetCard>
  );
}

// ── Facilities status (1×1, owner) ──────────────────────────────

export function FacilitiesWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const query = useQuery({ queryKey: qk.facilities(club.id), queryFn: () => fetchFacilities(club.id) });
  const facilities = query.data?.facilities ?? [];

  return (
    <WidgetCard title={t("game.dash.facilitiesProgress")} icon={Banknote}>
      {query.isLoading ? (
        <Skeleton className="h-16 w-full" aria-hidden="true" />
      ) : facilities.length === 0 ? (
        <EmptyState title={t("common.empty")} className="py-4" />
      ) : (
        <ul className="space-y-1.5">
          {facilities.map((f) => (
            <li key={f.type} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">{t(`facility.${f.type}`)}</span>
              <Progress value={(f.level / 10) * 100} className="h-1.5" aria-label={`${t(`facility.${f.type}`)} ${t("facility.level", { level: f.level })}`} />
              <Badge variant="outline" className="shrink-0 text-[10px]">{f.level}/10</Badge>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-2 min-h-9 w-full justify-between px-2" onClick={() => setSection("club", "facilities")}>
        {t("game.nav.facilities")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </WidgetCard>
  );
}

// ── Treasury controls (1×1, owner) ──────────────────────────────

export function TreasuryControlsWidget({ club }: WidgetContentProps) {
  const { t, formatCurrency } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  return (
    <WidgetCard title={t("game.dash.w.treasuryControls")} icon={Landmark}>
      <div className="flex h-full flex-col justify-between gap-2">
        <div className="space-y-1">
          <KV label={t("game.dash.fund")}>{formatCurrency(club.operatingFund)}</KV>
          <KV label={t("game.dash.debt")}>{formatCurrency(club.debt)}</KV>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("game.dash.treasuryNote")}</p>
        <Button variant="outline" size="sm" className="min-h-9 w-full" onClick={() => setSection("club", "finances")}>
          <Landmark aria-hidden="true" className="mr-1 size-4" />
          {t("game.dash.w.openTreasury")}
        </Button>
      </div>
    </WidgetCard>
  );
}

// ── Manager contract (1×1, owner) ───────────────────────────────

export function ManagerContractWidget({ club }: WidgetContentProps) {
  const { t, formatCurrency } = useI18n();
  const { data: world } = useQuery({ queryKey: qk.world, queryFn: () => import("@/components/game/api").then((m) => m.fetchWorldState()), refetchInterval: 60_000 });
  const contract = club.contract;

  return (
    <WidgetCard title={t("game.dash.w.managerContract")} icon={Bot}>
      {!contract ? (
        <EmptyState title={t("game.dash.w.noManager")} className="py-4" icon={Bot} />
      ) : (
        <div className="flex h-full flex-col justify-between gap-2">
          <div className="grid grid-cols-2 gap-2">
            <KV label={t("game.dash.w.total")}>{formatCurrency(contract.totalAmount)}</KV>
            <KV label={t("game.dash.w.daily")}>{formatCurrency(contract.dailySalary)}</KV>
            <KV label={t("game.dash.w.duration")}>{t("game.dash.w.days", { n: contract.durationDays })}</KV>
            <KV label={t("game.dash.w.remaining")}>
              {world?.season?.seasonDay !== undefined
                ? t("game.dash.w.days", { n: Math.max(0, contract.endDay - world.season.seasonDay) })
                : "—"}
            </KV>
          </div>
          <Button variant="ghost" size="sm" className="min-h-9 w-full justify-between px-2" onClick={() => useViewStore.getState().setSection("club")}>
            {t("game.nav.section.club")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      )}
    </WidgetCard>
  );
}

// ── Insolvency risk (1×1, owner) ────────────────────────────────

export function InsolvencyRiskWidget({ club }: WidgetContentProps) {
  const { t, formatCurrency } = useI18n();
  const risk = club.finState;
  const tone =
    risk === "HEALTHY" ? "text-brand-soft" : risk === "BANKRUPT" ? "text-destructive" : "text-warning";

  return (
    <WidgetCard title={t("game.dash.w.insolvency")} icon={ShieldAlert}>
      <div className="flex h-full flex-col justify-between gap-2">
        <div className="space-y-1">
          <KV label={t("game.dash.finState")}>
            <span className={cn("font-semibold", tone)}>{t(`game.dash.fin.${risk}`)}</span>
          </KV>
          <KV label={t("game.dash.debt")}>{formatCurrency(club.debt)}</KV>
          <KV label={t("game.dash.w.unpaidDays")}>{club.debt > 0 ? t("game.dash.w.days", { n: Math.max(0, Math.floor(club.debt / Math.max(1, club.operatingFund))) }) : "0"}</KV>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("game.dash.w.insolvencyHint")}</p>
      </div>
    </WidgetCard>
  );
}

// ── Calendar (1×2) ──────────────────────────────────────────────

export function CalendarWidget({ club }: WidgetContentProps) {
  const { t, formatDate } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  const query = useQuery({
    queryKey: ["fixtures", "next5", club.id],
    queryFn: () => fetchFixtures({ clubId: club.id, limit: 30 }),
    refetchInterval: 120_000,
  });
  const fixtures = (query.data?.fixtures ?? []).filter((f) => f.status === "SCHEDULED").slice(0, 5);

  return (
    <WidgetCard title={t("game.dash.calendar")} icon={CalendarDays}>
      {query.isLoading ? (
        <Skeleton className="h-24 w-full" aria-hidden="true" />
      ) : fixtures.length === 0 ? (
        <EmptyState title={t("game.dash.noNextMatch")} className="py-4" icon={CalendarDays} />
      ) : (
        <ul className="space-y-1">
          {fixtures.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-xs">
              <Badge variant="outline" className="shrink-0 border-brand/30 text-[10px]">
                {t(`comp.${f.competition}`)}
              </Badge>
              <span className="min-w-0 flex-1 truncate">
                {f.home.id === club.id ? f.away.name : f.home.name}
                <span className="ml-1 text-[10px] text-muted-foreground">
                  ({f.home.id === club.id ? t("game.dash.home") : t("game.dash.away")})
                </span>
              </span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatDate(f.kickoffUtc)}</span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" size="sm" className="mt-2 min-h-9 w-full justify-between px-2" onClick={() => setSection("competitions", "calendar")}>
        {t("game.comp.tab.calendar")}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Button>
    </WidgetCard>
  );
}

// ── Club identity mini (1×1, both — compact club header) ────────

export function ClubIdentityWidget({ club }: WidgetContentProps) {
  const { t } = useI18n();
  const setSection = useViewStore((s) => s.setSection);
  return (
    <WidgetCard title={t("game.nav.section.club")} icon={Building2}>
      <div className="flex h-full flex-col justify-between gap-2">
        <div className="flex items-center gap-3">
          <BrandBadge brand={club.brand} name={club.name} size="lg" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold">{club.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="min-h-9 w-full justify-between px-2" onClick={() => setSection("club")}>
          {t("game.nav.section.club")}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </WidgetCard>
  );
}
