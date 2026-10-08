"use client";
// Knight FM — Season calendar tab (Task 27-f).
// The season at a glance: one cell per season day (1..SEASON_TOTAL_DAYS) with
// the active club's fixtures grouped by matchDay, color-coded per competition,
// a "today" pill on the current day and a subtle ring on cup/world FINALS.
// Clicking a day with a PLAYED fixture opens the shared MatchDetailDialog.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { SEASON_TOTAL_DAYS } from "@/lib/types";
import {
  fetchFixtures,
  fetchWorldState,
  qk,
  type FixtureRow,
} from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { BrandBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/game/ui/bits";
import { MatchDetailDialog } from "@/components/game/competitions/match-dialog";

// A fixture belongs to the CURRENT season when it kicked off within the last
// 37.5 days (the season is 37 days long; +0.5 tolerates the transition window).
const SEASON_WINDOW_MS = (SEASON_TOTAL_DAYS + 0.5) * 86_400_000;

/** Competition → dot/legend color (never the only signal: the legend labels it). */
const COMP_DOT: Record<string, string> = {
  LEAGUE: "bg-primary",
  REGIONAL_CUP: "bg-amber-500",
  WORLD_CHAMPIONSHIP: "bg-violet-500",
  FRIENDLY: "bg-zinc-400",
};

/** Subtle ring for FINAL days: amber for the regional cup, violet for the world final. */
function finalRingOf(fixtures: FixtureRow[]): string {
  if (fixtures.some((f) => f.stage === "F" && f.competition === "WORLD_CHAMPIONSHIP")) {
    return "ring-1 ring-violet-500/40";
  }
  if (fixtures.some((f) => f.stage === "F" && f.competition === "REGIONAL_CUP")) {
    return "ring-1 ring-amber-500/40";
  }
  return "";
}

// ── Cell pieces ─────────────────────────────────────────────────

function DayHeader({ day, isToday }: { day: number; isToday: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-1">
      <span className={cn("text-[11px] font-semibold tabular-nums", isToday && "text-primary")}>
        {t("game.comp.cal.day", { n: day })}
      </span>
      {isToday && (
        <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-primary-foreground">
          {t("game.comp.cal.today")}
        </span>
      )}
    </div>
  );
}

function CalendarFixtureLine({ fixture, myClubId }: { fixture: FixtureRow; myClubId: string | null }) {
  const { t } = useI18n();
  const isHome = myClubId !== null && fixture.home.id === myClubId;
  const opponent = isHome ? fixture.away : fixture.home;
  const dot = COMP_DOT[fixture.competition] ?? "bg-muted-foreground/40";

  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      <BrandBadge brand={opponent.brand} name={opponent.name} size="sm" className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[11px]">{opponent.name}</span>
      <span className="shrink-0 rounded border border-border/70 px-1 text-[9px] leading-4 text-muted-foreground">
        {isHome ? t("game.dash.home") : t("game.dash.away")}
      </span>
      {fixture.status === "PLAYED" && fixture.score ? (
        <span className="shrink-0 font-mono text-[11px] font-medium tabular-nums">
          {fixture.score.home}–{fixture.score.away}
        </span>
      ) : (
        <span className="shrink-0 text-[9px] text-muted-foreground">{t("game.comp.cal.pending")}</span>
      )}
    </div>
  );
}

function CalendarDayCell({
  day,
  fixtures,
  isToday,
  myClubId,
  onOpen,
}: {
  day: number;
  fixtures: FixtureRow[];
  isToday: boolean;
  myClubId: string | null;
  onOpen: (f: FixtureRow) => void;
}) {
  const { t } = useI18n();
  const ring = finalRingOf(fixtures);
  const playable = fixtures.find((f) => f.status === "PLAYED") ?? null;

  if (fixtures.length === 0) {
    // Texture: quiet dashed day cell when the club rests.
    return (
      <div className="min-h-11 rounded-lg border border-dashed bg-muted/20 p-2">
        <DayHeader day={day} isToday={isToday} />
      </div>
    );
  }

  const body = (
    <>
      <DayHeader day={day} isToday={isToday} />
      <div className="mt-1 space-y-1">
        {fixtures.map((f) => (
          <CalendarFixtureLine key={f.id} fixture={f} myClubId={myClubId} />
        ))}
      </div>
    </>
  );

  if (!playable) {
    return <div className={cn("min-h-11 rounded-lg border bg-card/60 p-2", ring)}>{body}</div>;
  }

  const first = playable;
  return (
    <button
      type="button"
      onClick={() => onOpen(first)}
      className={cn(
        "min-h-11 rounded-lg border bg-card/60 p-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        ring
      )}
      aria-label={t("game.comp.cal.day", { n: day }) + `: ${first.home.name} ${first.score ? `${first.score.home}–${first.score.away}` : "vs"} ${first.away.name}`}
      title={t("game.comp.cal.day", { n: day })}
    >
      {body}
    </button>
  );
}

// ── Tab ─────────────────────────────────────────────────────────

export function CalendarTab() {
  const { t } = useI18n();
  const { club: myClub } = useActiveClub();
  const [dialogFixture, setDialogFixture] = React.useState<FixtureRow | null>(null);

  const worldQ = useQuery({ queryKey: qk.world, queryFn: fetchWorldState, refetchInterval: 60_000 });
  const fixturesQ = useQuery({
    queryKey: ["fixtures", "calendar", myClub?.id ?? "none"],
    queryFn: () => fetchFixtures({ clubId: myClub!.id, limit: 200 }),
    enabled: !!myClub,
  });

  // Current season day (1..37); ≤0 → preseason/between seasons (no "today" pill).
  const season = worldQ.data?.season ?? null;
  const gameDay = worldQ.data?.gameDay ?? 0;
  const seasonDay = season ? gameDay - season.startEpochDay + 1 : 0;
  const isSeasonLive = seasonDay >= 1 && seasonDay <= SEASON_TOTAL_DAYS;

  // Current-season fixtures only, grouped by matchDay.
  const byDay = React.useMemo(() => {
    const map = new Map<number, FixtureRow[]>();
    const cutoff = Date.now() - SEASON_WINDOW_MS;
    for (const f of fixturesQ.data?.fixtures ?? []) {
      if (new Date(f.kickoffUtc).getTime() < cutoff) continue;
      if (f.matchDay < 1 || f.matchDay > SEASON_TOTAL_DAYS) continue;
      const list = map.get(f.matchDay) ?? [];
      list.push(f);
      map.set(f.matchDay, list);
    }
    return map;
  }, [fixturesQ.data]);

  const hasFixtures = byDay.size > 0;

  return (
    <div className="space-y-4">
      {/* Header + legend (competition names carry the meaning; dots only reinforce) */}
      <div>
        <p className="text-sm font-semibold">{t("game.comp.cal.title")}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label={t("game.comp.cal.legend")}>
          <span className="font-semibold uppercase tracking-wide">{t("game.comp.cal.legend")}:</span>
          {(["LEAGUE", "REGIONAL_CUP", "WORLD_CHAMPIONSHIP", "FRIENDLY"] as const).map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn("size-2 rounded-full", COMP_DOT[c])} />
              {t(`comp.${c}`)}
            </span>
          ))}
        </div>
      </div>

      {/* Between seasons / preseason → muted status line instead of the today pill.
          Post-reset window: honest countdown to Season 1's first kickoff. */}
      {seasonDay <= 0 && (
        <p role="status" className="text-xs text-muted-foreground">
          {worldQ.data?.nextSeason
            ? t("game.comp.cal.seasonStartsIn", {
                n: worldQ.data.nextSeason.number,
                d: worldQ.data.nextSeason.startsInDays,
              })
            : t("game.comp.cal.preseason")}
        </p>
      )}

      {fixturesQ.isLoading ? (
        <TableSkeleton rows={5} cols={4} />
      ) : fixturesQ.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void fixturesQ.refetch()} />
      ) : !hasFixtures ? (
        <EmptyState title={t("game.comp.cal.noFixtures")} />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto pr-1" role="region" aria-label={t("game.comp.cal.title")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: SEASON_TOTAL_DAYS }, (_, i) => i + 1).map((day) => (
              <CalendarDayCell
                key={day}
                day={day}
                fixtures={byDay.get(day) ?? []}
                isToday={isSeasonLive && seasonDay === day}
                myClubId={myClub?.id ?? null}
                onOpen={setDialogFixture}
              />
            ))}
          </div>
        </div>
      )}

      <MatchDetailDialog
        fixture={dialogFixture}
        open={!!dialogFixture}
        onOpenChange={(v) => !v && setDialogFixture(null)}
      />
    </div>
  );
}
