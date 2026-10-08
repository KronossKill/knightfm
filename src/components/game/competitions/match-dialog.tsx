"use client";
// Knight FM — match detail dialog (Task 4-a, shared by dashboard & competitions).
// NOTE (lead): the fixtures endpoint does not expose `matchId`, so callers pass
// the fixture id; /api/competitions/match/[id] resolves Match rows by Match.id.
// Until the lead bridges the two (expose matchId in the fixtures response or add
// a fixtureId fallback), a 404 renders the honest "unavailable" state below.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CircleOff,
  Cross,
  Goal,
  Hourglass,
  RectangleHorizontal,
  Repeat,
  Star,
  Target,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/components/auth/store";
import { fetchMatch, qk, type FixtureRow, type MatchDetail } from "@/components/game/api";
import { BrandBadge, EmptyState, ErrorState } from "@/components/game/ui/bits";
import { ClubSquadDialog } from "@/components/game/competitions/club-squad-dialog";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  GOAL: Goal,
  OWN_GOAL: Goal,
  PENALTY: Target,
  MISSED_PENALTY: CircleOff,
  YELLOW_CARD: RectangleHorizontal,
  RED_CARD: RectangleHorizontal,
  SUBSTITUTION: Repeat,
  INJURY: Cross,
  ASSIST: Star,
};

function eventColor(type: string): string {
  switch (type) {
    case "GOAL":
    case "PENALTY":
      return "text-primary";
    case "OWN_GOAL":
    case "RED_CARD":
      return "text-destructive";
    case "YELLOW_CARD":
      return "text-amber-400";
    default:
      return "text-muted-foreground";
  }
}

function StatRow({
  label,
  home,
  away,
  format,
}: {
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const fmt = format ?? ((n: number) => String(n));
  const total = home + away;
  const homePct = total > 0 ? (home / total) * 100 : 50;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-mono tabular-nums">{fmt(home)}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{fmt(away)}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${homePct}%` }} />
        <div className="h-full flex-1 bg-muted-foreground/40" />
      </div>
    </div>
  );
}

export function MatchDetailDialog({
  fixture,
  open,
  onOpenChange,
}: {
  fixture: FixtureRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, formatDate } = useI18n();
  // Task 26: view either club's squad straight from the match detail.
  const [squadClubId, setSquadClubId] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.match(fixture?.id ?? "none"),
    queryFn: () => fetchMatch(fixture!.id),
    enabled: open && !!fixture,
    staleTime: 60_000,
    retry: false,
  });

  const match = query.data?.match;
  const notFound = query.error instanceof ApiError && query.error.code === "MATCH_NOT_FOUND";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("game.comp.matchDialog")}</DialogTitle>
          {fixture && (
            <DialogDescription>
              {t(`comp.${fixture.competition}`)}
              {fixture.matchDay ? ` · ${t("fixtures.matchday", { n: fixture.matchDay })}` : ""}
              {" · "}
              {formatDate(fixture.kickoffUtc)}
            </DialogDescription>
          )}
        </DialogHeader>

        {query.isLoading && (
          <div className="space-y-3" aria-hidden="true">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {query.error && !query.isLoading && (
          notFound ? (
            <EmptyState title={t("game.comp.matchUnavailable")} hint={t("game.comp.viewSchedule", { hour: 19 })} icon={Hourglass} />
          ) : (
            <ErrorState
              message={query.error instanceof Error ? query.error.message : t("err.generic")}
              onRetry={() => void query.refetch()}
            />
          )
        )}

        {match && (
          <div className="space-y-5">
            {/* Score header */}
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card/60 p-4">
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                <BrandBadge brand={match.home.brand} name={match.home.name} size="lg" />
                <span className="truncate text-sm font-semibold">{match.home.name}</span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSquadClubId(match.home.id)}
                >
                  {t("game.comp.squad.view")}
                </button>
              </div>
              <div className="flex flex-col items-center px-2">
                <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                  {match.home.goals} – {match.away.goals}
                </span>
                {match.motm && (
                  <Badge variant="outline" className="mt-1.5 border-amber-500/40 text-[10px] text-amber-300">
                    <Star aria-hidden="true" className="mr-1 size-3 fill-amber-400 text-amber-400" />
                    {t("match.motm")}: {match.motm.name}
                  </Badge>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center">
                <BrandBadge brand={match.away.brand} name={match.away.name} size="lg" />
                <span className="truncate text-sm font-semibold">{match.away.name}</span>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-md px-2 text-[11px] text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setSquadClubId(match.away.id)}
                >
                  {t("game.comp.squad.view")}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3 rounded-xl border p-4">
              <StatRow
                label={t("match.possession")}
                home={match.stats.possession.home}
                away={match.stats.possession.away}
                format={(n) => `${n}%`}
              />
              <StatRow label={t("match.shots")} home={match.stats.shots.home} away={match.stats.shots.away} />
              <StatRow
                label={t("match.xg")}
                home={match.stats.xg.home}
                away={match.stats.xg.away}
                format={(n) => n.toFixed(2)}
              />
            </div>

            {/* Events timeline */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("game.comp.events")}
              </h4>
              {match.events.length === 0 ? (
                <EmptyState title={t("game.comp.noEvents")} className="py-6" />
              ) : (
                <ol className="max-h-64 space-y-1.5 overflow-y-auto pr-1" aria-label={t("game.comp.events")}>
                  {match.events.map((ev, i) => {
                    const Icon = EVENT_ICONS[ev.type] ?? Goal;
                    const isHome = ev.clubId === match.home.id;
                    return (
                      <li
                        key={`${ev.minute}-${ev.type}-${i}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                          isHome ? "justify-start" : "flex-row-reverse text-right"
                        )}
                      >
                        <span className="w-8 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                          {ev.minute}&prime;
                        </span>
                        <Icon aria-hidden="true" className={cn("size-4 shrink-0", eventColor(ev.type))} />
                        <span className="min-w-0 flex-1 truncate">
                          {ev.playerName ?? "—"}
                          {ev.type === "OWN_GOAL" ? ` (${t("game.comp.event.OWN_GOAL")})` : ""}
                          {ev.type !== "GOAL" && ev.type !== "ASSIST" && ev.type !== "OWN_GOAL" ? (
                            <span className="ml-1 text-xs text-muted-foreground">· {t(`game.comp.event.${ev.type}`)}</span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <p className="text-center text-[11px] text-muted-foreground">{formatDate(match.playedAt)}</p>
          </div>
        )}
      </DialogContent>
      </Dialog>

      {/* Task 26: rival squad + rescission-clause flow */}
      <ClubSquadDialog clubId={squadClubId} open={!!squadClubId} onOpenChange={(v) => !v && setSquadClubId(null)} />
    </>
  );
}