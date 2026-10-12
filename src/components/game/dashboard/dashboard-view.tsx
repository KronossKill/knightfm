"use client";
// Knight FM — Dashboard view (Task 4-a).
// Manager variant: previous match (with report dialog), next match with UTC
// countdown, tactical readiness (from tactics API), fitness warnings and inbox
// preview + assistant CTA.
// Owner variant: finances, squad summary, facilities progress, next-5 calendar
// and treasury quick-actions note. Switches on the club role from /api/club/mine.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Banknote,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AssistantAvatar } from "@/components/game/assistant/assistant-avatar";

// ── Match card (previous / next) ────────────────────────────────

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

function PreviousMatchCard({ clubId }: { clubId: string }) {
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.lastMatch")}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
    </Card>
  );
}

function NextMatchCard({ club }: { club: ClubMine }) {
  const { t, formatDate } = useI18n();
  const nowMs = useNow(1000);
  const fx = club.nextFixture;

  return (
    <Card className="border-primary/25">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.nextMatch")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!fx ? (
          <EmptyState title={t("game.dash.noNextMatch")} className="py-6" icon={CalendarDays} />
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="outline" className={cn(fx.isHome ? "border-primary/40 text-primary" : "border-amber-500/40 text-amber-300")}>
                  {fx.isHome ? t("game.dash.home") : t("game.dash.away")}
                </Badge>
                <span className="text-xs text-muted-foreground">{t("game.dash.opponent")}</span>
              </div>
              <span className="truncate text-sm font-semibold">{fx.opponentName}</span>
            </div>
            <div className="flex items-baseline justify-between rounded-lg bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">{t("game.dash.kickoffIn")}</span>
              <span className="font-mono text-lg font-bold tabular-nums text-primary">
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
      </CardContent>
    </Card>
  );
}

// ── Manager-only cards ──────────────────────────────────────────

function ReadinessCard({ club }: { club: ClubMine }) {
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
  const avail = tacticsQ.data?.availability;
  const lineupPct = avail && avail.total > 0 ? Math.round((avail.available / avail.total) * 100) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.readiness")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tacticsQ.isLoading || playersQ.isLoading ? (
          <>
            <Skeleton className="h-10 w-full" aria-hidden="true" />
            <Skeleton className="h-4 w-2/3" aria-hidden="true" />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">{t("game.dash.formation")}</span>
              <button
                type="button"
                onClick={() => setView("tactics")}
                className="flex min-h-11 items-center gap-1 rounded-md font-mono text-base font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {tacticsQ.data?.formation ?? "—"}
                <ArrowRight aria-hidden="true" className="size-4" />
              </button>
            </div>
            {lineupPct !== null && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("game.dash.lineup")}</span>
                  <span className="font-mono tabular-nums">
                    {avail!.available}/{avail!.total}
                  </span>
                </div>
                <Progress value={lineupPct} aria-label={`${t("game.dash.lineup")}: ${lineupPct}%`} />
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
    </Card>
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

function InboxPreviewCard() {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const query = useQuery({ queryKey: qk.notifications, queryFn: fetchNotifications, refetchInterval: 60_000 });
  const items = query.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.inboxPreview")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" aria-hidden="true" />
        ) : items.length === 0 ? (
          <EmptyState title={t("common.empty")} className="py-6" icon={Mail} />
        ) : (
          <ul className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {items.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                {!n.readAt && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{n.typeKey}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" className="min-h-11 flex-1" onClick={() => setView("inbox")}>
            <Mail aria-hidden="true" className="mr-1 size-4" />
            {t("game.nav.inbox")}
          </Button>
          <Button
            size="sm"
            className="min-h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setView("assistant")}
          >
            <AssistantAvatar size="sm" className="mr-1.5 size-5 rounded-md" />
            {t("game.dash.askAssistant")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Owner-only cards ────────────────────────────────────────────

const FIN_TONE: Record<string, string> = {
  HEALTHY: "border-primary/40 text-primary",
  INSOLVENT: "border-amber-500/40 text-amber-300",
  POSSIBLE_BANKRUPTCY: "border-amber-500/40 text-amber-300",
  BANKRUPT: "border-destructive/40 text-destructive",
};

function FinanceCard({ club }: { club: ClubMine }) {
  const { t, formatCurrency } = useI18n();
  const setView = useViewStore((s) => s.setView);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.finance")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("treasury")}>
          <Landmark aria-hidden="true" className="mr-1 size-4" />
          {t("game.nav.treasury")}
        </Button>
      </CardContent>
    </Card>
  );
}

function SquadSummaryCard({ club }: { club: ClubMine }) {
  const { t, formatCurrency } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const playersQ = useQuery({ queryKey: qk.players(club.id), queryFn: () => fetchPlayers(club.id) });
  const players = playersQ.data?.players ?? [];
  const avgOvr = players.length > 0 ? Math.round(players.reduce((a, p) => a + p.ovr, 0) / players.length) : null;
  const totalValue = players.reduce((a, p) => a + p.marketValue, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.squadSummary")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {playersQ.isLoading ? (
          <Skeleton className="h-12 w-full" aria-hidden="true" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <KV label={t("game.dash.players")}>{club.playerCount}/{club.capacity.finalCapacity}</KV>
            <KV label={t("game.dash.avgOvr")}>{avgOvr ?? "—"}</KV>
            <KV label={t("game.squad.value")}>{formatCurrency(totalValue)}</KV>
          </div>
        )}
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("squad")}>
          {t("game.nav.squad")}
          <ArrowRight aria-hidden="true" className="ml-1 size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function FacilitiesProgressCard({ club }: { club: ClubMine }) {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  const query = useQuery({ queryKey: qk.facilities(club.id), queryFn: () => fetchFacilities(club.id) });
  const facilities = query.data?.facilities ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.facilitiesProgress")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isLoading ? (
          <Skeleton className="h-16 w-full" aria-hidden="true" />
        ) : facilities.length === 0 ? (
          <EmptyState title={t("common.empty")} className="py-6" />
        ) : (
          <ul className="space-y-2">
            {facilities.map((f) => (
              <li key={f.type} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">{t(`facility.${f.type}`)}</span>
                <Progress value={(f.level / 10) * 100} className="h-1.5" aria-label={`${t(`facility.${f.type}`)} ${t("facility.level", { level: f.level })}`} />
                <Badge variant="outline" className="shrink-0 text-[10px]">{f.level}/10</Badge>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" className="min-h-11 w-full" onClick={() => setView("facilities")}>
          {t("game.nav.facilities")}
          <ArrowRight aria-hidden="true" className="mr-1 size-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function CalendarCard({ clubId }: { clubId: string }) {
  const { t, formatDate } = useI18n();
  const query = useQuery({
    queryKey: ["fixtures", "next5", clubId],
    queryFn: () => fetchFixtures({ clubId, limit: 30 }),
    refetchInterval: 120_000,
  });
  const fixtures = (query.data?.fixtures ?? []).filter((f) => f.status === "SCHEDULED").slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.calendar")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-24 w-full" aria-hidden="true" />
        ) : fixtures.length === 0 ? (
          <EmptyState title={t("game.dash.noNextMatch")} className="py-6" icon={CalendarDays} />
        ) : (
          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {fixtures.map((f) => (
              <li key={f.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2.5 py-2 text-sm">
                <Badge variant="outline" className="shrink-0 border-primary/30 text-[10px]">
                  {t(`comp.${f.competition}`)}
                </Badge>
                <span className="min-w-0 flex-1 truncate">
                  {f.home.id === clubId ? f.away.name : f.home.name}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({f.home.id === clubId ? t("game.dash.home") : t("game.dash.away")})
                  </span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDate(f.kickoffUtc)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function StandingsMiniCard({ club }: { club: ClubMine }) {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: qk.standings(club.divisionId),
    queryFn: () => fetchStandings(club.divisionId),
    enabled: !!club.divisionId,
  });
  const rows = query.data?.standings ?? [];
  const mine = rows.find((r) => r.club.id === club.id) ?? null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy aria-hidden="true" className="size-4 text-primary" />
          {t("game.dash.standings")}
        </CardTitle>
        <CardDescription>
          {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <Skeleton className="h-12 w-full" aria-hidden="true" />
        ) : !mine ? (
          <EmptyState title={t("game.comp.noStandings")} className="py-6" icon={Trophy} />
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-primary/15 font-mono text-lg font-bold text-primary">
              {mine.position}
            </span>
            <div className="grid flex-1 grid-cols-4 gap-2 text-center">
              <KV label={t("standings.played")}>{mine.played}</KV>
              <KV label={t("standings.points")}>{mine.points}</KV>
              <KV label={t("standings.gf")}>{mine.gf}</KV>
              <KV label={t("standings.ga")}>{mine.ga}</KV>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main view ───────────────────────────────────────────────────

export default function DashboardView({ clubs }: { clubs: ClubMine[] }) {
  const { t, formatCurrency } = useI18n();
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
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <BrandBadge brand={club.brand} name={club.name} size="lg" />
        <div>
          <h1 className="text-xl font-semibold leading-tight">
            {isOwner ? t("game.dash.titleOwner") : t("game.dash.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("game.dash.subtitle")}</p>
        </div>
        <Badge variant="outline" className="ml-auto border-primary/40 text-primary">
          {isOwner ? t("role.owner") : t("role.manager")}
        </Badge>
      </header>

      {/* Row 1 — matches (manager) / finance (owner) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PreviousMatchCard clubId={club.id} />
        <NextMatchCard club={club} />
      </div>

      {/* Row 2 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isOwner ? (
          <>
            <FinanceCard club={club} />
            <SquadSummaryCard club={club} />
            <FacilitiesProgressCard club={club} />
          </>
        ) : (
          <>
            <ReadinessCard club={club} />
            <InboxPreviewCard />
            <StandingsMiniCard club={club} />
          </>
        )}
      </div>

      {/* Row 3 — owner: calendar + treasury note; manager: calendar */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CalendarCard clubId={club.id} />
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Landmark aria-hidden="true" className="size-4 text-primary" />
              {t("game.nav.treasury")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{t("game.dash.treasuryNote")}</p>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-md bg-muted/50 px-2 py-1">
                {t("game.dash.fund")}: <span className="font-mono">{formatCurrency(club.operatingFund)}</span>
              </span>
              <span className="rounded-md bg-muted/50 px-2 py-1">
                {t("game.dash.debt")}: <span className="font-mono">{formatCurrency(club.debt)}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
