"use client";
// Knight FM — Dashboard WIDGET REGISTRY (Task 91, UI/UX master mandate).
// The Dashboard is a fully customizable widget hub: every widget is a
// self-contained card (owns its react-query), declares its allowed sizes and
// roles, and renders dense, glanceable, ACTIONABLE content (progressive
// disclosure: deep info on click). All strings via i18n; all colors via
// semantic tokens; skeletons while loading; honest empty/error states.
//
// Widgets never mutate game state: action buttons NAVIGATE (view-store) —
// the world is server-authoritative and the UI is a control/observation layer.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BellRing,
  Building2,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  FlaskConical,
  Gem,
  Globe2,
  Landmark,
  Minus,
  PieChart,
  ScrollText,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useViewStore, type GameView } from "@/components/game/view-store";
import {
  fetchFacilities,
  fetchFixtures,
  fetchMyClubs,
  fetchNotifications,
  fetchPlayers,
  fetchStandings,
  fetchWorldState,
  type ClubMine,
  type FixtureRow,
  type PlayerRow,
  type StandingsRow,
} from "@/components/game/api";
import {
  BrandBadge,
  EmptyState,
  ErrorState,
  formatCountdown,
  formatUtcClock,
  useNow,
} from "@/components/game/ui/bits";
import { MatchDetailDialog } from "@/components/game/competitions/match-dialog";
import type { NotificationItem } from "@/components/game/markets/types";

// ── Shared widget plumbing ──────────────────────────────────────

export type WidgetSize = { w: 1 | 2; h: 1 | 2 };
export type DashboardRole = "MANAGER" | "OWNER";

export interface WidgetContext {
  /** ACTIVE club (top-bar switcher) with full shape — null while loading/club-less. */
  club: ClubMine | null;
  /** Clubs grouped by the user's role, for role-specific data. */
  clubs: ClubMine[];
}

export interface WidgetDef {
  id: string;
  labelKey: string;
  descKey: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: DashboardRole[];
  defaultSize: WidgetSize;
  /** Sizes the widget can be resized to (cycle order). */
  allowedSizes: WidgetSize[];
  render: (ctx: WidgetContext) => React.ReactNode;
}

function useMyClub(role?: DashboardRole) {
  const activeClubId = useViewStore((s) => s.activeClubId);
  const q = useQuery({ queryKey: ["dashboard", "myClubs"], queryFn: fetchMyClubs, staleTime: 30_000 });
  const clubs = q.data?.clubs ?? [];
  const pool = role ? clubs.filter((c) => c.role === role) : clubs;
  const club = pool.find((c) => c.id === activeClubId) ?? pool[0] ?? clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;
  return { club, isLoading: q.isLoading };
}

/** Compact section link that navigates via the view store (no dead ends). */
function WidgetLink({ view, labelKey }: { view: GameView; labelKey: string }) {
  const { t } = useI18n();
  const setView = useViewStore((s) => s.setView);
  return (
    <Button variant="ghost" size="sm" className="min-h-9 px-2 text-xs text-primary hover:text-primary" onClick={() => setView(view)}>
      {t(labelKey)}
      <ArrowRight aria-hidden="true" className="ml-1 size-3.5" />
    </Button>
  );
}

function WidgetSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-5 w-full" />
      ))}
    </div>
  );
}

// ── Fixtures helpers ────────────────────────────────────────────

function FixtureLine({ fixture }: { fixture: FixtureRow }) {
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

// ── Widget: next-match (2×1) ────────────────────────────────────

function NextMatchWidget({ club }: { club: ClubMine | null }) {
  const { t, formatDate } = useI18n();
  const nowMs = useNow(1000);
  const q = useQuery({
    queryKey: ["dashboard", "fixtures", "next", club?.id],
    queryFn: () => fetchFixtures({ clubId: club!.id, status: "SCHEDULED", limit: 5 }),
    enabled: !!club,
    refetchInterval: 120_000,
  });
  const next = (q.data?.fixtures ?? []).find((f) => f.status === "SCHEDULED") ?? null;

  return (
    <div className="flex h-full flex-col gap-2.5">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : !next ? (
        <EmptyState title={t("game.dash.noNextMatch")} className="py-4" icon={ClipboardList} />
      ) : (
        <>
          <FixtureLine fixture={next} />
          <p className="text-[11px] text-muted-foreground">
            {t(`comp.${next.competition}`)}
            {next.matchDay ? ` · ${t("fixtures.matchday", { n: next.matchDay })}` : ""} · {formatDate(next.kickoffUtc)}
          </p>
          <div className="mt-auto flex items-center justify-between gap-2">
            <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-primary">
              {t("game.dash.kickoffIn")} {formatCountdown(new Date(next.kickoffUtc).getTime(), nowMs)}
            </span>
            <WidgetLink view="competitions" labelKey="game.dash.calendarLink" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: last-match (2×1) ────────────────────────────────────

function LastMatchWidget({ club }: { club: ClubMine | null }) {
  const { t, formatDate } = useI18n();
  const [dialog, setDialog] = React.useState<FixtureRow | null>(null);
  const q = useQuery({
    queryKey: ["dashboard", "fixtures", "prev", club?.id],
    queryFn: () => fetchFixtures({ clubId: club!.id, status: "PLAYED", limit: 5 }),
    enabled: !!club,
    refetchInterval: 120_000,
  });
  const last = (q.data?.fixtures ?? []).filter((f) => f.status === "PLAYED")[0] ?? null;

  return (
    <div className="flex h-full flex-col gap-2.5">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : !last ? (
        <EmptyState title={t("game.dash.noLastMatch")} className="py-4" icon={ClipboardList} />
      ) : (
        <>
          <FixtureLine fixture={last} />
          <p className="text-[11px] text-muted-foreground">
            {t(`comp.${last.competition}`)}
            {last.matchDay ? ` · ${t("fixtures.matchday", { n: last.matchDay })}` : ""} · {formatDate(last.kickoffUtc)}
          </p>
          <div className="mt-auto">
            <Button variant="outline" size="sm" className="min-h-9 w-full sm:w-auto" onClick={() => setDialog(last)}>
              <ArrowRight aria-hidden="true" className="mr-1 size-4" />
              {t("game.dash.viewMatch")}
            </Button>
          </div>
        </>
      )}
      <MatchDetailDialog fixture={dialog} open={!!dialog} onOpenChange={(v) => !v && setDialog(null)} />
    </div>
  );
}

// ── Widget: tactical-readiness (1×1) ────────────────────────────

function ReadinessWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "players", club?.id],
    queryFn: () => fetchPlayers(club!.id),
    enabled: !!club,
    staleTime: 60_000,
  });
  const players: PlayerRow[] = q.data?.players ?? [];
  const total = players.length;
  const injured = players.filter((p) => p.injuredUntil).length;
  const suspended = players.filter((p) => p.suspension > 0).length;
  const fatigued = players.filter((p) => p.fatigue > 70).length;
  const available = Math.max(0, total - injured - suspended);
  const readyPct = total === 0 ? 0 : Math.round((available / total) * 100);

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums text-primary">{readyPct}%</span>
            <span className="text-[11px] text-muted-foreground">{available}/{total}</span>
          </div>
          <Progress value={readyPct} aria-label={t("game.dash.readiness")} />
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {injured > 0 && <li>⚠ {t("game.dash.injuredWarning", { n: injured })}</li>}
            {suspended > 0 && <li>🚫 {t("game.dash.suspendedWarning", { n: suspended })}</li>}
            {fatigued > 0 && <li>💤 {t("game.dash.fatigueWarning", { n: fatigued })}</li>}
            {injured === 0 && suspended === 0 && fatigued === 0 && <li>✓ {t("game.dash.allFit")}</li>}
          </ul>
          <div className="mt-auto">
            <WidgetLink view="tactics" labelKey="game.dash.readiness" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: squad-status (1×1) ──────────────────────────────────

function SquadStatusWidget({ club }: { club: ClubMine | null }) {
  const { t, formatCurrency } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "players", club?.id],
    queryFn: () => fetchPlayers(club!.id),
    enabled: !!club,
    staleTime: 60_000,
  });
  const players: PlayerRow[] = q.data?.players ?? [];
  const avgOvr = players.length === 0 ? 0 : Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length);
  const payroll = players.reduce((s, p) => s + p.salary, 0);

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-muted/40 p-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.players")}</dt>
              <dd className="text-lg font-bold tabular-nums">{players.length}</dd>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.avgOvr")}</dt>
              <dd className="text-lg font-bold tabular-nums text-primary">{avgOvr}</dd>
            </div>
            <div className="rounded-md bg-muted/40 p-2">
              <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.payroll")}</dt>
              <dd className="truncate text-sm font-bold tabular-nums">{formatCurrency(payroll)}</dd>
            </div>
          </dl>
          <div className="mt-auto">
            <WidgetLink view="squad" labelKey="game.nav.squad" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: inbox (1×1) ─────────────────────────────────────────

function InboxWidget() {
  const { t, formatCurrency } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  });
  const items: NotificationItem[] = q.data?.items ?? [];
  const unread = q.data?.unread ?? 0;

  // Same honest label pattern as the inbox module: translate typeKey with
  // payload interpolation; unknown types fall back to the GENERIC sentence.
  const labelOf = (item: NotificationItem): string => {
    const vars: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(item.payload ?? {})) {
      if (typeof v === "string") vars[k] = v;
      else if (typeof v === "number") vars[k] = k === "amount" || k === "price" || k === "net" || k === "levy" ? formatCurrency(v) : v;
    }
    const rendered = t(`markets.inbox.notif.${item.typeKey}`, vars);
    return rendered.startsWith("markets.inbox.notif.") ? t("markets.inbox.notif.GENERIC") : rendered;
  };

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : items.length === 0 ? (
        <EmptyState title={t("game.dash.inboxEmpty")} className="py-4" icon={BellRing} />
      ) : (
        <>
          {unread > 0 && (
            <Badge className="w-fit bg-primary/15 text-primary hover:bg-primary/15">
              {t("game.shell.unread", { n: unread })}
            </Badge>
          )}
          <ul className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
            {items.slice(0, 3).map((n) => (
              <li key={n.id} className="truncate text-xs text-muted-foreground">
                <span className={cn("mr-1.5 inline-block size-1.5 rounded-full align-middle", n.readAt ? "bg-muted-foreground/40" : "bg-primary")} aria-hidden="true" />
                {labelOf(n)}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <WidgetLink view="inbox" labelKey="game.nav.inbox" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: world-clock (1×1) ───────────────────────────────────

function WorldClockWidget() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["dashboard", "world"], queryFn: fetchWorldState, refetchInterval: 60_000 });
  const nowMs = useNow(1000);
  const hydrated = nowMs > 0;
  const season = q.data?.season ?? null;
  const seasonLine = season
    ? season.preseasonDay !== undefined
      ? t("world.preseasonDay", { day: season.preseasonDay })
      : t("world.seasonDay", { day: season.seasonDay ?? 0 })
    : "—";
  const nextKickoff = q.data?.nextKickoffUtc ? new Date(q.data.nextKickoffUtc).getTime() : null;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 py-2 text-center">
      <Globe2 aria-hidden="true" className="size-5 text-primary" />
      <span className="font-mono text-2xl font-bold tabular-nums">
        {hydrated ? formatUtcClock(nowMs) : "--:--:--"}
        <span className="ml-1 align-top text-[10px] font-normal text-muted-foreground">UTC</span>
      </span>
      <span className="text-xs text-muted-foreground">
        {t("world.gameDay")} {q.data?.gameDay ?? "—"}
      </span>
      <span className="text-[11px] text-muted-foreground">{seasonLine}</span>
      {nextKickoff && nextKickoff > nowMs && (
        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-primary">
          ⚽ {formatCountdown(nextKickoff, nowMs)}
        </span>
      )}
      <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">{t("world.liveNow")}</p>
    </div>
  );
}

// ── Widget: world-pulse (1×2) — Master UI/UX v2.0 "living world" mandate ──

interface PulseMatch {
  id: string;
  competition: string;
  stage: string | null;
  matchDay: number;
  kickoffAt: string;
  home: string;
  away: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface PulseData {
  seasonNumber: number | null;
  online: { total: number; countries: { country: string | null; n: number }[] };
  results: PulseMatch[];
  upcoming: PulseMatch[];
}

async function fetchWorldPulse(): Promise<PulseData> {
  const res = await fetch("/api/world/pulse", { cache: "no-store" });
  if (!res.ok) throw new String(res.status);
  const json = (await res.json()) as { data?: PulseData } & Partial<PulseData>;
  return json.data ?? (json as PulseData);
}

function PulseRow({ m }: { m: PulseMatch }) {
  const played = typeof m.homeGoals === "number" && typeof m.awayGoals === "number";
  const kickoff = new Date(m.kickoffAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return (
    <li className="flex items-center gap-2 py-1">
      <span className="w-14 shrink-0 truncate text-[10px] uppercase tracking-wider text-muted-foreground" title={m.competition}>
        {m.competition === "LEAGUE" ? `J${m.matchDay}` : m.stage ?? m.competition.slice(0, 3)}
      </span>
      <span className="min-w-0 flex-1 truncate text-right" title={m.home}>{m.home}</span>
      <span className="shrink-0 rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums">
        {played ? `${m.homeGoals}\u2013${m.awayGoals}` : kickoff}
      </span>
      <span className="min-w-0 flex-1 truncate" title={m.away}>{m.away}</span>
    </li>
  );
}

function WorldPulseWidget() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "worldPulse"],
    queryFn: fetchWorldPulse,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-muted/60" />
        ))}
      </div>
    );
  }
  if (q.isError || !q.data) {
    return <p className="py-4 text-xs text-muted-foreground">{t("game.dash.w.worldPulseEmpty")}</p>;
  }

  const d = q.data;
  const topCountries = d.online.countries.slice(0, 3);
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto pr-0.5 text-xs">
      {/* Online snapshot — the world is alive right now */}
      <p className="flex items-center gap-1.5 font-medium">
        <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {t("game.dash.w.worldPulseOnline")}
        <span className="font-mono tabular-nums text-muted-foreground">{d.online.total}</span>
        {topCountries.length > 0 && (
          <span className="ml-auto truncate font-mono text-[10px] uppercase text-muted-foreground" title={topCountries.map((c) => c.country ?? "?").join(", ")}>
            {topCountries.map((c) => `${c.country ?? "?"} ${c.n}`).join(" · ")}
          </span>
        )}
      </p>

      <section aria-label={t("game.dash.w.worldPulseResults")}>
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("game.dash.w.worldPulseResults")}</p>
        <ul className="divide-y divide-border/60">
          {d.results.slice(0, 6).map((m) => (
            <PulseRow key={m.id} m={m} />
          ))}
          {d.results.length === 0 && <li className="py-2 text-muted-foreground">{t("game.dash.w.worldPulseEmpty")}</li>}
        </ul>
      </section>

      <section aria-label={t("game.dash.w.worldPulseUpcoming")}>
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t("game.dash.w.worldPulseUpcoming")}</p>
        <ul className="divide-y divide-border/60">
          {d.upcoming.slice(0, 4).map((m) => (
            <PulseRow key={m.id} m={m} />
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Widget: standings (1×2) ─────────────────────────────────────

function StandingsWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "standings", club?.divisionId],
    queryFn: () => fetchStandings(club!.divisionId),
    enabled: !!club,
    staleTime: 60_000,
  });
  const rows: StandingsRow[] = [...(q.data?.standings ?? [])].sort((a, b) => a.position - b.position);
  const top = rows.slice(0, 5);
  const mineIdx = rows.findIndex((r) => club && r.club.id === club.id);
  const mine = mineIdx >= 0 ? rows[mineIdx] : null;

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : top.length === 0 ? (
        <EmptyState title={t("game.dash.standingsEmpty")} className="py-4" icon={Trophy} />
      ) : (
        <>
          <ol className="min-h-0 flex-1 space-y-1">
            {top.map((r, i) => (
              <li key={r.club.id ?? i} className="flex items-center gap-2 text-xs">
                <span className="w-4 shrink-0 text-right font-mono tabular-nums text-muted-foreground">{r.position}</span>
                <span className={cn("min-w-0 flex-1 truncate", club && r.club.id === club.id && "font-semibold text-primary")}>
                  {r.club.name}
                </span>
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                  {r.points} {t("game.dash.ptsShort")}
                </span>
              </li>
            ))}
          </ol>
          {mine && (
            <p className="text-[11px] text-muted-foreground">
              {t("game.dash.myPosition", { pos: mineIdx + 1, pts: mine.points })}
            </p>
          )}
          <div className="mt-auto">
            <WidgetLink view="competitions" labelKey="game.dash.standings" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: calendar (1×2) ──────────────────────────────────────

function CalendarWidget({ club }: { club: ClubMine | null }) {
  const { t, formatDate } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "fixtures", "cal", club?.id],
    queryFn: () => fetchFixtures({ clubId: club!.id, status: "SCHEDULED", limit: 5 }),
    enabled: !!club,
    refetchInterval: 120_000,
  });
  const fixtures = (q.data?.fixtures ?? []).filter((f) => f.status === "SCHEDULED").slice(0, 5);

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={4} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : fixtures.length === 0 ? (
        <EmptyState title={t("game.dash.noNextMatch")} className="py-4" icon={CalendarDays} />
      ) : (
        <>
          <ul className="min-h-0 flex-1 space-y-1.5">
            {fixtures.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-xs">
                <CalendarDays aria-hidden="true" className="size-3.5 shrink-0 text-primary/80" />
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground">{formatDate(f.kickoffUtc)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {f.home.name} – {f.away.name}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{t(`comp.${f.competition}`)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <WidgetLink view="competitions" labelKey="game.dash.calendarLink" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: club-finance (2×1, OWNER) ───────────────────────────

function FinanceWidget({ club }: { club: ClubMine | null }) {
  const { t, formatCurrency } = useI18n();
  if (!club) {
    return <EmptyState title={t("game.dash.noClub")} className="py-6" icon={Landmark} />;
  }
  return (
    <div className="flex h-full flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-md bg-muted/40 p-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.fund")}</dt>
          <dd className="truncate font-mono text-sm font-bold tabular-nums text-primary">{formatCurrency(club.operatingFund)}</dd>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.debt")}</dt>
          <dd className={cn("truncate font-mono text-sm font-bold tabular-nums", club.debt > 0 ? "text-destructive" : "")}>
            {formatCurrency(club.debt)}
          </dd>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.finState")}</dt>
          <dd className="truncate text-sm font-semibold">{t(`game.dash.fin.${club.finState}`)}</dd>
        </div>
        <div className="rounded-md bg-muted/40 p-2">
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.players")}</dt>
          <dd className="font-mono text-sm font-bold tabular-nums">{club.playerCount}</dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center justify-between gap-2">
        {club.finState !== "HEALTHY" && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <ShieldAlert aria-hidden="true" className="size-3.5" />
            {t("game.dash.fin." + club.finState)}
          </span>
        )}
        <span className="ml-auto flex gap-2">
          <WidgetLink view="treasury" labelKey="game.nav.treasury" />
          <WidgetLink view="markets" labelKey="game.nav.markets" />
        </span>
      </div>
    </div>
  );
}

// ── Widget: facilities (1×1) ────────────────────────────────────

function FacilitiesWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "facilities", club?.id],
    queryFn: () => fetchFacilities(club!.id),
    enabled: !!club,
    staleTime: 60_000,
  });
  const facilities = q.data?.facilities ?? [];
  const avg = facilities.length === 0 ? 0 : Math.round(facilities.reduce((s, f) => s + f.level, 0) / facilities.length);
  const upgrading = facilities.filter((f) => f.upgrade);

  return (
    <div className="flex h-full flex-col gap-2">
      {q.isLoading ? (
        <WidgetSkeleton lines={2} />
      ) : q.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />
      ) : facilities.length === 0 ? (
        <EmptyState title={t("game.dash.noClub")} className="py-4" icon={Building2} />
      ) : (
        <>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold tabular-nums text-primary">{avg}</span>
            <span className="text-[11px] text-muted-foreground">{t("game.dash.facilitiesAvgLevel")}</span>
          </div>
          <ul className="space-y-1">
            {facilities.slice(0, 3).map((f) => (
              <li key={f.type} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{t(`facility.${f.type}`)}</span>
                <span className="shrink-0 font-mono tabular-nums font-semibold">{f.level}</span>
              </li>
            ))}
          </ul>
          {upgrading.length > 0 && (
            <p className="text-[11px] text-amber-400">
              🔨 {t("game.dash.w.facilitiesUpgrading", { n: upgrading.length })}
            </p>
          )}
          <div className="mt-auto">
            <WidgetLink view="facilities" labelKey="game.nav.facilities" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Widget: treasury-controls (1×1, OWNER) ──────────────────────

function TreasuryControlsWidget({ club }: { club: ClubMine | null }) {
  const { t, formatCurrency } = useI18n();
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="rounded-md bg-muted/40 p-2 text-center">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.fund")}</p>
        <p className="font-mono text-lg font-bold tabular-nums text-primary">{formatCurrency(club?.operatingFund ?? 0)}</p>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("game.dash.treasuryNote")}</p>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => useViewStore.getState().setView("treasury")}>
          <Gem aria-hidden="true" className="mr-1 size-3.5" />
          {t("game.dash.treasuryInvest")}
        </Button>
        <Button size="sm" variant="outline" className="min-h-9" onClick={() => useViewStore.getState().setView("wallet")}>
          <Wallet aria-hidden="true" className="mr-1 size-3.5" />
          {t("game.nav.wallet")}
        </Button>
      </div>
    </div>
  );
}

// ── Widget: youth (1×1) ─────────────────────────────────────────

function YouthWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "youth", club?.id],
    queryFn: () => fetchPlayers(club!.id),
    enabled: false, // placeholder query kept OFF — youth data via dedicated widget link
  });
  void q;
  return (
    <div className="flex h-full flex-col items-start justify-center gap-2">
      <FlaskConical aria-hidden="true" className="size-5 text-primary" />
      <p className="text-xs text-muted-foreground">{t("game.dash.youthHint")}</p>
      <div className="mt-auto">
        <WidgetLink view="youth" labelKey="game.nav.youth" />
      </div>
    </div>
  );
}


// ── Widget: top-performers (1×1, MANAGER) — Master UI/UX v2.0 ──

function TopPerformersWidget({ club }: { club: ClubMine | null }) {
  const { t, lang } = useI18n();
  const q = useQuery({
    queryKey: ["dashboard", "players", club?.id],
    queryFn: () => fetchPlayers(club!.id),
    enabled: !!club,
    staleTime: 60_000,
  });
  const players = React.useMemo(
    () => [...(q.data?.players ?? [])].sort((a, b) => b.ovr - a.ovr).slice(0, 5),
    [q.data],
  );

  if (q.isLoading) return <WidgetSkeleton lines={4} />;
  if (q.isError) return <ErrorState message={t("err.generic")} onRetry={() => void q.refetch()} className="py-4" />;
  if (players.length === 0) return <EmptyState title={t("game.dash.w.noPlayers")} />;

  return (
    <div className="flex h-full flex-col justify-between gap-1">
      <ol className="space-y-1.5" aria-label={t("game.dash.w.topPerformers")}>
        {players.map((p, i) => {
          const trend = p.trendPerAttribute?.["ovr"] ?? "flat";
          return (
            <li key={p.id} className="flex items-center gap-2 text-sm">
              <span className="w-4 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{p.firstName[0]}. {p.lastName}</span>
              <span className="shrink-0 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{p.detailedPos}</span>
              {trend === "up" && <TrendingUp aria-label={t("player.trend.up")} className="size-3.5 shrink-0 text-primary" />}
              {trend === "down" && <TrendingDown aria-label={t("player.trend.down")} className="size-3.5 shrink-0 text-destructive" />}
              {trend === "flat" && <Minus aria-label={t("player.trend.flat")} className="size-3.5 shrink-0 text-muted-foreground" />}
              <span className="w-7 shrink-0 text-right font-mono font-bold tabular-nums">{p.ovr}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex justify-end">
        <WidgetLink view="squad" labelKey="game.nav.squad" />
      </div>
    </div>
  );
}

// ── Widget: squad-overview (2×1, OWNER) — Master UI/UX v2.0 ──

function SquadOverviewWidget({ club }: { club: ClubMine | null }) {
  const { t, lang } = useI18n();
  const fmt = React.useMemo(() => new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 }), [lang]);
  const q = useQuery({
    queryKey: ["dashboard", "players", club?.id],
    queryFn: () => fetchPlayers(club!.id),
    enabled: !!club,
    staleTime: 60_000,
  });
  const players = q.data?.players ?? [];
  const avgOvr = players.length ? Math.round(players.reduce((s, p) => s + p.ovr, 0) / players.length) : 0;
  const totalValue = players.reduce((s, p) => s + p.marketValue, 0);
  const wages = players.reduce((s, p) => s + p.salary, 0);
  const capacity = club?.capacity.finalCapacity ?? 0;
  const usage = capacity > 0 ? Math.min(100, Math.round((club!.playerCount / capacity) * 100)) : 0;

  return (
    <div className="flex h-full flex-col justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t("game.dash.w.squadOverview")}</span>
          <span className="font-mono font-bold tabular-nums">{club?.playerCount ?? 0} / {capacity}</span>
        </div>
        <Progress value={usage} aria-label={t("game.dash.w.squadOverview")} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.w.avgOvr")}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{avgOvr}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.w.totalValue")}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{fmt.format(totalValue)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{t("game.dash.w.weeklyWages")}</dt>
          <dd className="font-mono text-lg font-bold tabular-nums">{fmt.format(wages)}</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <WidgetLink view="squad" labelKey="game.nav.squad" />
      </div>
    </div>
  );
}

// ── Widget: manager-contract (1×1, OWNER) — Master UI/UX v2.0 ──

function ManagerContractWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const contract = club?.contract ?? null;
  const worldQ = useQuery({
    queryKey: ["dashboard", "world"],
    queryFn: fetchWorldState,
    staleTime: 30_000,
  });
  const gameDay = worldQ.data?.gameDay ?? 0;
  const remaining = contract ? Math.max(0, contract.endDay - gameDay) : 0;

  if (!contract) {
    return (
      <div className="flex h-full flex-col justify-between">
        <EmptyState title={t("game.dash.w.noContract")} />
        <div className="flex justify-end">
          <WidgetLink view="markets" labelKey="game.nav.markets" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="space-y-0.5">
        <p className="font-mono text-xl font-bold tabular-nums">{contract.totalAmount.toLocaleString()} KS</p>
        <p className="text-xs text-muted-foreground">
          {t("game.dash.w.dailySalary")}: <span className="font-mono tabular-nums">{contract.dailySalary.toLocaleString()} KS</span>
        </p>
      </div>
      <div className="space-y-2">
        <Badge variant="outline" className="min-h-6 border-primary/40 text-xs text-primary">
          {t("game.dash.w.remainingDays", { n: remaining })}
        </Badge>
        <div className="flex justify-end">
          <WidgetLink view="treasury" labelKey="game.nav.treasury" />
        </div>
      </div>
    </div>
  );
}

// ── Widget: insolvency-risk (1×1, OWNER) — Master UI/UX v2.0 ──

const RISK_STYLES: Record<string, string> = {
  HEALTHY: "border-primary/40 bg-primary/10 text-primary",
  INSOLVENT: "border-destructive/40 bg-destructive/10 text-destructive",
  POSSIBLE_BANKRUPTCY: "border-destructive/40 bg-destructive/10 text-destructive",
  BANKRUPT: "border-danger bg-danger text-white",
};

function InsolvencyRiskWidget({ club }: { club: ClubMine | null }) {
  const { t } = useI18n();
  const finState = club?.finState ?? "HEALTHY";
  const atRisk = finState !== "HEALTHY";
  const style = RISK_STYLES[finState] ?? RISK_STYLES.HEALTHY;

  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <div className="flex items-center gap-1.5">
        {atRisk && <ShieldAlert aria-hidden="true" className="size-4 shrink-0 text-destructive" />}
        <Badge variant="outline" className={`min-h-6 text-xs ${style}`}>
          {t(`game.dash.fin.${finState}`)}
        </Badge>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t("game.dash.w.debt")}</dt>
          <dd className={`font-mono font-bold tabular-nums ${club && club.debt > 0 ? "text-destructive" : ""}`}>
            {(club?.debt ?? 0).toLocaleString()} KS
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t("game.dash.w.operatingFund")}</dt>
          <dd className="font-mono font-bold tabular-nums">{(club?.operatingFund ?? 0).toLocaleString()} KS</dd>
        </div>
      </dl>
      <div className="flex justify-end">
        <WidgetLink view="treasury" labelKey="game.nav.treasury" />
      </div>
    </div>
  );
}

// ── Registry ────────────────────────────────────────────────────

const S = (w: 1 | 2, h: 1 | 2): WidgetSize => ({ w, h });

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "next-match",
    labelKey: "game.dash.nextMatch",
    descKey: "game.dash.w.nextMatchDesc",
    icon: CalendarDays,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(2, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <NextMatchWidget club={club} />,
  },
  {
    id: "last-match",
    labelKey: "game.dash.lastMatch",
    descKey: "game.dash.w.lastMatchDesc",
    icon: ClipboardList,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(2, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <LastMatchWidget club={club} />,
  },
  {
    id: "readiness",
    labelKey: "game.dash.readiness",
    descKey: "game.dash.w.readinessDesc",
    icon: Dumbbell,
    roles: ["MANAGER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <ReadinessWidget club={club} />,
  },
  {
    id: "squad-status",
    labelKey: "game.dash.squadSummary",
    descKey: "game.dash.w.squadStatusDesc",
    icon: Users,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <SquadStatusWidget club={club} />,
  },
  {
    id: "inbox",
    labelKey: "game.dash.inboxPreview",
    descKey: "game.dash.w.inboxDesc",
    icon: BellRing,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(1, 2), S(2, 2)],
    render: () => <InboxWidget />,
  },
  {
    id: "world-clock",
    labelKey: "game.dash.w.worldClock",
    descKey: "game.dash.w.worldClockDesc",
    icon: Globe2,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1)],
    render: () => <WorldClockWidget />,
  },
  {
    id: "standings",
    labelKey: "game.dash.standings",
    descKey: "game.dash.w.standingsDesc",
    icon: Trophy,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 2),
    allowedSizes: [S(1, 1), S(1, 2), S(2, 2), S(2, 1)],
    render: ({ club }) => <StandingsWidget club={club} />,
  },
  {
    id: "calendar",
    labelKey: "game.dash.calendar",
    descKey: "game.dash.w.calendarDesc",
    icon: CalendarDays,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 2),
    allowedSizes: [S(1, 1), S(1, 2), S(2, 2), S(2, 1)],
    render: ({ club }) => <CalendarWidget club={club} />,
  },
  {
    id: "finance",
    labelKey: "game.dash.finance",
    descKey: "game.dash.w.financeDesc",
    icon: Landmark,
    roles: ["OWNER"],
    defaultSize: S(2, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <FinanceWidget club={club} />,
  },
  {
    id: "facilities",
    labelKey: "game.dash.facilitiesProgress",
    descKey: "game.dash.w.facilitiesDesc",
    icon: Building2,
    roles: ["OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(1, 2), S(2, 2)],
    render: ({ club }) => <FacilitiesWidget club={club} />,
  },
  {
    id: "treasury-controls",
    labelKey: "game.dash.w.treasuryControls",
    descKey: "game.dash.w.treasuryControlsDesc",
    icon: Gem,
    roles: ["OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1)],
    render: ({ club }) => <TreasuryControlsWidget club={club} />,
  },
  {
    id: "youth",
    labelKey: "game.nav.youth",
    descKey: "game.dash.w.youthDesc",
    icon: FlaskConical,
    roles: ["MANAGER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1)],
    render: ({ club }) => <YouthWidget club={club} />,
  },
  {
    // Master UI/UX v2.0: squad top performers ("Top Performers").
    id: "top-performers",
    labelKey: "game.dash.w.topPerformers",
    descKey: "game.dash.w.topPerformersDesc",
    icon: TrendingUp,
    roles: ["MANAGER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <TopPerformersWidget club={club} />,
  },
  {
    // Master UI/UX v2.0: owner roster snapshot ("Squad Overview").
    id: "squad-overview",
    labelKey: "game.dash.w.squadOverview",
    descKey: "game.dash.w.squadOverviewDesc",
    icon: PieChart,
    roles: ["OWNER"],
    defaultSize: S(2, 1),
    allowedSizes: [S(1, 1), S(2, 1), S(2, 2), S(1, 2)],
    render: ({ club }) => <SquadOverviewWidget club={club} />,
  },
  {
    // Master UI/UX v2.0: active manager contract ("Manager Contract").
    id: "manager-contract",
    labelKey: "game.dash.w.managerContract",
    descKey: "game.dash.w.managerContractDesc",
    icon: ScrollText,
    roles: ["OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1)],
    render: ({ club }) => <ManagerContractWidget club={club} />,
  },
  {
    // Master UI/UX v2.0: insolvency risk ("Insolvency Risk"). Debt, operating
    // fund and fin state — the owner's early-warning card.
    id: "insolvency-risk",
    labelKey: "game.dash.w.insolvencyRisk",
    descKey: "game.dash.w.insolvencyRiskDesc",
    icon: ShieldAlert,
    roles: ["OWNER"],
    defaultSize: S(1, 1),
    allowedSizes: [S(1, 1), S(2, 1)],
    render: ({ club }) => <InsolvencyRiskWidget club={club} />,
  },
  {
    // Master UI/UX v2.0: live feed of the wider football world — the "living
    // world" answer to FM26's "lost world building" criticism. Both roles get
    // it by default; read-only, refetches every minute.
    id: "world-pulse",
    labelKey: "game.dash.w.worldPulse",
    descKey: "game.dash.w.worldPulseDesc",
    icon: Globe2,
    roles: ["MANAGER", "OWNER"],
    defaultSize: S(1, 2),
    allowedSizes: [S(1, 1), S(1, 2), S(2, 2)],
    render: () => <WorldPulseWidget />,
  },
];

export const widgetById = (id: string): WidgetDef | undefined => WIDGET_REGISTRY.find((w) => w.id === id);

/** Code-owned role defaults (mandate: role-based default widgets). */
export function defaultLayout(role: DashboardRole): { id: string; w: 1 | 2; h: 1 | 2 }[] {
  return WIDGET_REGISTRY.filter((w) => w.roles.includes(role)).map((w) => ({ id: w.id, ...w.defaultSize }));
}

/** Resolve the user's dashboard role from their clubs (manager path wins). */
export function resolveRole(clubs: ClubMine[]): DashboardRole {
  if (clubs.some((c) => c.role === "MANAGER")) return "MANAGER";
  if (clubs.some((c) => c.role === "OWNER")) return "OWNER";
  return "MANAGER";
}

/** Active club for the widget context (view-store selection wins). */
export function activeClubOf(clubs: ClubMine[]): ClubMine | null {
  const activeClubId = useViewStore.getState().activeClubId;
  return clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;
}

// Re-export for the grid.
export { useMyClub };
