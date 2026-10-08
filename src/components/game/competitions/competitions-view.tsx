"use client";
// Knight FM — Competitions view (Task 4-a).
// Tabs: Standings (region/division cascade, WC/REL zones with position badges +
// legend), Fixtures (my club, day filter, match detail dialog), Calendar (Task
// 27-f: the 37-day season at a glance), Cups (rounds +
// champion), World Championship (league table + knockout bracket by stage).

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, Globe, Info, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import {
  fetchCups,
  fetchFixtures,
  fetchRegions,
  fetchStandings,
  fetchWorldCup,
  qk,
  type ClubRef,
  type FixtureRow,
  type Region,
} from "@/components/game/api";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { BrandBadge, EmptyState, ErrorState, TableSkeleton } from "@/components/game/ui/bits";
import CinemaHeader from "@/components/game/ui/cinema-header";
import { MatchDetailDialog } from "@/components/game/competitions/match-dialog";
import { ClubSquadDialog } from "@/components/game/competitions/club-squad-dialog";
import { CalendarTab } from "@/components/game/competitions/season-calendar";

// ── Region / division selectors ─────────────────────────────────

interface Cascade {
  regionId: string | null;
  divisionId: string | null;
  setRegion: (id: string) => void;
  setDivision: (id: string) => void;
  regions: Region[] | undefined;
  isLoading: boolean;
}

function RegionDivisionSelect({ cascade, labels }: { cascade: Cascade; labels: { region: string; division: string; myDivision?: string } }) {
  const { t } = useI18n();
  const region = cascade.regions?.find((r) => r.id === cascade.regionId) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={cascade.regionId ?? ""}
        onValueChange={(v) => cascade.setRegion(v)}
        disabled={cascade.isLoading}
      >
        <SelectTrigger className="min-h-11 w-48" aria-label={labels.region}>
          <SelectValue placeholder={labels.region} />
        </SelectTrigger>
        <SelectContent>
          {cascade.regions?.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {t(r.nameKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={cascade.divisionId ?? ""}
        onValueChange={(v) => cascade.setDivision(v)}
        disabled={!region}
      >
        <SelectTrigger className="min-h-11 w-40" aria-label={labels.division}>
          <SelectValue placeholder={labels.division} />
        </SelectTrigger>
        <SelectContent>
          {region?.divisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {labels.division} {d.index}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {labels.myDivision && (
        <Badge variant="outline" className="border-primary/40 text-primary">
          {labels.myDivision}
        </Badge>
      )}
    </div>
  );
}

function useRegionCascade() {
  const regionsQ = useQuery({ queryKey: qk.regions, queryFn: fetchRegions });
  // Task 23-e: the cascade defaults to the ACTIVE club's region/division.
  const { club: myClub } = useActiveClub();
  const [regionId, setRegionId] = React.useState<string | null>(null);
  const [divisionId, setDivisionId] = React.useState<string | null>(null);

  const initialized = React.useRef(false);
  React.useEffect(() => {
    if (initialized.current) return;
    const regions = regionsQ.data?.regions;
    if (regions && regions.length > 0) {
      const myRegion = myClub ? regions.find((r) => r.id === myClub.regionId) ?? regions[0] : regions[0];
      setRegionId(myRegion.id);
      setDivisionId(myClub?.divisionId ?? myRegion.divisions[0]?.id ?? null);
      initialized.current = true;
    }
  }, [regionsQ.data, myClub]);

  const setRegion = (id: string) => {
    setRegionId(id);
    const region = regionsQ.data?.regions.find((r) => r.id === id);
    setDivisionId(region?.divisions[0]?.id ?? null);
  };

  return {
    regionId,
    divisionId,
    setRegion,
    setDivision: setDivisionId,
    regions: regionsQ.data?.regions,
    isLoading: regionsQ.isLoading,
  } as Cascade;
}

// ── Standings tab ───────────────────────────────────────────────

function StandingsTab() {
  const { t } = useI18n();
  const cascade = useRegionCascade();
  const { club: myClub } = useActiveClub();
  // Task 26: click a club → rival squad dialog (rescission-clause flow).
  const [squadClubId, setSquadClubId] = React.useState<string | null>(null);
  const query = useQuery({
    queryKey: qk.standings(cascade.divisionId ?? "none"),
    queryFn: () => fetchStandings(cascade.divisionId!),
    enabled: !!cascade.divisionId,
  });

  const rows = query.data?.standings ?? [];
  const total = rows.length;
  // Zones are SERVER-DRIVEN (Task 22): GET /api/competitions/standings returns
  // the same slot values the season-transition engine uses, so the badges can
  // never disagree with the actual promotion/relegation logic.
  //   • WC  — top-N of Primera División qualify for the Club World Cup.
  //   • PROM — top-N of every division FROM THE 2ND promote.
  //   • REL — bottom-N of every division relegate, EXCEPT the last division,
  //           whose bottom teams always stay.
  const divisionIndex = query.data?.division?.index ?? null;
  const isTopDivision = divisionIndex === 1;
  const zones = query.data?.zones;
  const promoSlotsCfg = zones?.promotionSlots ?? 3;
  const relegaSlotsCfg = zones?.relegationSlots ?? 3;
  const wcSlotsCfg = zones?.worldCupSlots ?? 3;
  const isLastDivision = zones?.isLastDivision ?? false;
  // Zone sizes mirror the engine exactly (promotions first; the relegation
  // count is clamped so a club can never appear in two zones).
  const promoCount = isTopDivision ? 0 : Math.min(promoSlotsCfg, total);
  const relCount = isLastDivision ? 0 : Math.min(relegaSlotsCfg, Math.max(0, total - promoCount));
  const wcCount = isTopDivision ? Math.min(wcSlotsCfg, total) : 0;
  const wcZone = (pos: number) => pos <= wcCount;
  const promZone = (pos: number) => pos <= promoCount;
  const relZone = (pos: number) => pos > total - relCount;

  return (
    <div className="space-y-4">
      <RegionDivisionSelect
        cascade={cascade}
        labels={{
          region: t("game.comp.region"),
          division: t("game.comp.division"),
          myDivision: cascade.divisionId === myClub?.divisionId ? t("game.comp.myDivision") : undefined,
        }}
      />

      {query.isLoading ? (
        <TableSkeleton rows={10} cols={8} />
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={t("game.comp.noStandings")} icon={Trophy} />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <caption className="sr-only">{t("standings.title")}</caption>
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">#</th>
                      <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t("common.club")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.played")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.won")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.drawn")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.lost")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.gf")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.ga")}</th>
                      <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.points")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const wc = wcZone(row.position);
                      const prom = promZone(row.position);
                      const rel = relZone(row.position);
                      const mine = row.club.id === myClub?.id;
                      return (
                        <tr
                          key={row.club.id}
                          className={cn(
                            "border-b last:border-0",
                            wc && "bg-primary/10",
                            prom && "bg-amber-500/10",
                            rel && "bg-destructive/10",
                            mine && "font-semibold"
                          )}
                        >
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-1.5">
                              <span className="w-6 font-mono tabular-nums">{row.position}</span>
                              {wc && (
                                <Badge aria-label={t("game.comp.zone.wc")} className="bg-primary px-1 text-[10px] text-primary-foreground">
                                  WC
                                </Badge>
                              )}
                              {prom && (
                                <Badge aria-label={t("game.comp.zone.prom")} className="bg-amber-600 px-1 text-[10px] text-white">
                                  PROM
                                </Badge>
                              )}
                              {rel && (
                                <Badge aria-label={t("game.comp.zone.rel")} className="bg-destructive px-1 text-[10px] text-white">
                                  REL
                                </Badge>
                              )}
                            </span>
                          </td>
                          <td className="max-w-52 px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setSquadClubId(row.club.id)}
                              className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={t("game.comp.squad.viewClub", { club: row.club.name })}
                              title={t("game.comp.squad.viewClub", { club: row.club.name })}
                            >
                              <BrandBadge brand={row.club.brand} name={row.club.name} size="sm" />
                              <span className="truncate underline-offset-2 hover:underline">
                                {row.club.name}
                                {mine && <span className="ml-1 text-primary">•</span>}
                              </span>
                            </button>
                          </td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.played}</td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.won}</td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.drawn}</td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.lost}</td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.gf}</td>
                          <td className="px-2 py-2 text-center font-mono tabular-nums">{row.ga}</td>
                          <td className="px-2 py-2 text-center font-mono font-bold tabular-nums">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend (never color-only) */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground" aria-label={t("game.comp.legend")}>
            <span className="font-semibold uppercase tracking-wide">{t("game.comp.legend")}:</span>
            {isTopDivision && (
              <span className="flex items-center gap-1.5">
                <Badge className="bg-primary px-1 text-[10px] text-primary-foreground">WC</Badge>
                {t("game.comp.zone.wc")}
              </span>
            )}
            {!isTopDivision && (
              <span className="flex items-center gap-1.5">
                <Badge className="bg-amber-600 px-1 text-[10px] text-white">PROM</Badge>
                {t("game.comp.zone.prom")}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Badge className="bg-destructive px-1 text-[10px] text-white">REL</Badge>
              {t("game.comp.zone.rel")}
            </span>
            {isLastDivision && <span className="italic">{t("game.comp.zone.relNote")}</span>}
          </div>
        </>
      )}

      {/* Task 26: rival squad + rescission-clause flow */}
      <ClubSquadDialog clubId={squadClubId} open={!!squadClubId} onOpenChange={(v) => !v && setSquadClubId(null)} />
    </div>
  );
}

// ── Fixtures tab ────────────────────────────────────────────────

function FixtureRowItem({
  fixture,
  clubId,
  onOpen,
}: {
  fixture: FixtureRow;
  clubId: string | null;
  onOpen: (f: FixtureRow) => void;
}) {
  const { t, formatDate } = useI18n();
  const mine = clubId && (fixture.home.id === clubId || fixture.away.id === clubId);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(fixture)}
        className={cn(
          "flex w-full min-h-11 flex-wrap items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          mine && "border-primary/30"
        )}
        aria-label={`${fixture.home.name} ${fixture.score ? `${fixture.score.home} ${fixture.score.away}` : "vs"} ${fixture.away.name}`}
      >
        <Badge variant="outline" className="shrink-0 border-primary/30 text-[10px]">
          {t(`comp.${fixture.competition}`)}
        </Badge>
        <span className="min-w-0 flex-1 truncate">
          <span className="inline-flex items-center gap-1.5">
            <BrandBadge brand={fixture.home.brand} name={fixture.home.name} size="sm" />
            {fixture.home.name}
          </span>
          <span className="mx-1.5 font-mono font-semibold tabular-nums">
            {fixture.score ? `${fixture.score.home} – ${fixture.score.away}` : "vs"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            {fixture.away.name}
            <BrandBadge brand={fixture.away.brand} name={fixture.away.name} size="sm" />
          </span>
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {t("fixtures.matchday", { n: fixture.matchDay })} · {formatDate(fixture.kickoffUtc)}
        </span>
      </button>
    </li>
  );
}

function FixturesTab() {
  const { t } = useI18n();
  const { club: myClub } = useActiveClub();
  const [day, setDay] = React.useState<string>("all");
  const [dialogFixture, setDialogFixture] = React.useState<FixtureRow | null>(null);

  const query = useQuery({
    queryKey: ["fixtures", "mine", myClub?.id ?? "none"],
    queryFn: () => fetchFixtures({ clubId: myClub!.id, limit: 120 }),
    enabled: !!myClub,
  });
  const fixtures = query.data?.fixtures ?? [];
  const days = React.useMemo(
    () => [...new Set(fixtures.map((f) => f.matchDay))].sort((a, b) => a - b),
    [fixtures]
  );
  const visible = day === "all" ? fixtures : fixtures.filter((f) => String(f.matchDay) === day);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("game.comp.dayFilter")}</span>
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger className="min-h-11 w-44" aria-label={t("game.comp.dayFilter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("game.comp.allDays")}</SelectItem>
            {days.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {t("fixtures.matchday", { n: d })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <TableSkeleton rows={8} cols={3} />
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState title={t("game.comp.noFixtures")} />
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {visible.map((f) => (
            <FixtureRowItem key={f.id} fixture={f} clubId={myClub?.id ?? null} onOpen={setDialogFixture} />
          ))}
        </ul>
      )}

      <MatchDetailDialog
        fixture={dialogFixture}
        open={!!dialogFixture}
        onOpenChange={(v) => !v && setDialogFixture(null)}
      />
    </div>
  );
}

// ── Cups tab ────────────────────────────────────────────────────

function ClubChip({ club }: { club: ClubRef }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1 text-xs">
      <BrandBadge brand={club.brand} name={club.name} size="sm" />
      <span className="truncate">{club.name}</span>
    </span>
  );
}

// ── Bracket (cup / world-cup style board — user mandate Task 21) ──

interface BracketMatchRow {
  id: string;
  home: ClubRef;
  away: ClubRef;
  score: { home: number; away: number } | null;
  status: string;
  winner?: "home" | "away" | null;
}

function BracketTeamLine({ club, score, winner }: { club: ClubRef; score: number | null; winner: boolean | null }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1",
        winner === true && "font-semibold text-primary",
        winner === false && "text-muted-foreground/70"
      )}
    >
      <span className="flex min-w-0 items-center gap-1">
        <BrandBadge brand={club.brand} name={club.name} size="sm" />
        <span className="truncate">{club.name}</span>
      </span>
      <span className="shrink-0 font-mono font-bold tabular-nums">{score ?? "–"}</span>
    </div>
  );
}

/** Visual knockout board: one column per round, match cards with scores and the
 *  winner highlighted — at a glance who competes, who advances and whom they face. */
function BracketView({ rounds, ariaLabel }: { rounds: { label: string; matches: BracketMatchRow[] }[]; ariaLabel: string }) {
  return (
    <div className="overflow-x-auto pb-1" role="region" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-3">
        {rounds.map((col, ci) => (
          <div key={ci} className="w-52 shrink-0">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-primary">{col.label}</p>
            <ul className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {col.matches.map((m) => {
                // Server winner first (drawn ties are resolved by the engine's
                // elimination record); fall back to score comparison.
                const winner =
                  m.winner ??
                  (m.score
                    ? m.score.home > m.score.away
                      ? "home"
                      : m.score.away > m.score.home
                        ? "away"
                        : null
                    : null);
                return (
                  <li key={m.id} className="rounded-lg border bg-background/60 p-2">
                    <BracketTeamLine
                      club={m.home}
                      score={m.score ? m.score.home : null}
                      winner={winner === "home" ? true : winner === null ? null : false}
                    />
                    <div className="my-1 border-t border-dashed" aria-hidden="true" />
                    <BracketTeamLine
                      club={m.away}
                      score={m.score ? m.score.away : null}
                      winner={winner === "away" ? true : winner === null ? null : false}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Round header: the server sends the stage (F/SF/QF) once the round is a named
 *  knockout stage; earlier rounds are labeled by their round number. */
function bracketRoundLabel(
  round: number,
  stage: string | null,
  t: (key: string, vars?: Record<string, string | number>) => string
): string {
  if (stage && t(`game.comp.stage.${stage}`) !== `game.comp.stage.${stage}`) {
    return t(`game.comp.stage.${stage}`);
  }
  return t("game.comp.roundN", { n: round });
}

function CupsTab() {
  const { t } = useI18n();
  const cascade = useRegionCascade();
  const query = useQuery({
    queryKey: qk.cups(cascade.regionId ?? undefined),
    queryFn: () => fetchCups(cascade.regionId ?? undefined),
    enabled: !!cascade.regionId,
  });
  const data = query.data?.regions?.[0] ?? null;

  return (
    <div className="space-y-4">
      <RegionDivisionSelect
        cascade={{ ...cascade, divisionId: null, setDivision: () => undefined }}
        labels={{ region: t("game.comp.region"), division: t("game.comp.division") }}
      />

      {query.isLoading ? (
        <TableSkeleton rows={6} cols={3} />
      ) : query.isError ? (
        <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />
      ) : !data ? (
        <EmptyState title={t("game.comp.cupEmpty")} icon={Trophy} />
      ) : (
        <div className="space-y-4">
          {data.champion && (
            <Card className="border-amber-500/40 bg-amber-500/5">
              <CardContent className="flex items-center gap-3 p-4">
                <Crown aria-hidden="true" className="size-6 shrink-0 text-amber-400" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">{t("game.comp.champion")}</p>
                  <p className="truncate text-sm font-bold">{data.champion.name}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {t("game.comp.entrants", { n: data.entrants })}
                </span>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("game.comp.tab.cups")}</CardTitle>
              <CardDescription>{t("game.comp.entrants", { n: data.entrants })}</CardDescription>
            </CardHeader>
            <CardContent>
              {data.bracket.length === 0 && data.alive.length === 0 ? (
                <EmptyState title={t("game.comp.cupEmpty")} className="py-6" />
              ) : (
                <div className="space-y-3">
                  {/* Visual knockout board (Task 21): pairings, scores, winners */}
                  {data.bracket.length > 0 && (
                    <BracketView
                      ariaLabel={t("game.comp.bracket")}
                      rounds={data.bracket.map((r) => ({
                        label: bracketRoundLabel(r.round, r.stage, t),
                        matches: r.matches.map((m) => ({ id: m.id, home: m.home, away: m.away, score: m.score, status: m.status, winner: m.winner })),
                      }))}
                    />
                  )}
                  {data.alive.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                        {t("game.comp.alive")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {data.alive.map((c) => (
                          <ClubChip key={c.id} club={c} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── World Championship tab ──────────────────────────────────────

function WorldCupTab() {
  const { t } = useI18n();
  const query = useQuery({ queryKey: qk.worldcup, queryFn: fetchWorldCup });

  if (query.isLoading) return <TableSkeleton rows={8} cols={5} />;
  if (query.isError) return <ErrorState message={t("err.generic")} onRetry={() => void query.refetch()} />;

  const { table, knockout, worldCupActive } = query.data ?? { table: [], knockout: [], worldCupActive: false };

  if (table.length === 0 && knockout.length === 0) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground" role="note">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
          {t("game.comp.wcRule")}
        </p>
        {worldCupActive ? (
          <EmptyState title={t("game.comp.wcEmpty")} icon={Trophy} />
        ) : (
          // USER MANDATE: Season 1 has no Club World Cup — no qualified clubs exist yet.
          <EmptyState title={t("game.comp.wcSeason1")} hint={t("game.comp.wcEmpty")} icon={Globe} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Qualification rule (server-enforced in qualifyWorldCup) */}
      <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground" role="note">
        <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
        {t("game.comp.wcRule")}
      </p>
      {table.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("game.comp.wcTable")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <caption className="sr-only">{t("game.comp.wcTable")}</caption>
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">#</th>
                    <th scope="col" className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{t("common.club")}</th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("game.comp.source.league")}</th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.played")}</th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.gf")}</th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.ga")}</th>
                    <th scope="col" className="px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">{t("standings.points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.map((row, i) => (
                    <tr key={row.club.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono tabular-nums">{i + 1}</td>
                      <td className="max-w-52 px-3 py-2">
                        <span className="flex items-center gap-2">
                          <BrandBadge brand={row.club.brand} name={row.club.name} size="sm" />
                          <span className="truncate">{row.club.name}</span>
                          {row.eliminatedStage && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {t(`game.comp.stage.${row.eliminatedStage}`)}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center text-xs">{row.source === "CUP" ? t("game.comp.source.cup") : t("game.comp.source.league")}</td>
                      <td className="px-2 py-2 text-center font-mono tabular-nums">{row.played}</td>
                      <td className="px-2 py-2 text-center font-mono tabular-nums">{row.gf}</td>
                      <td className="px-2 py-2 text-center font-mono tabular-nums">{row.ga}</td>
                      <td className="px-2 py-2 text-center font-mono font-bold tabular-nums">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {knockout.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("game.comp.wcBracket")}</h3>
          <Card className="p-3">
            <BracketView
              ariaLabel={t("game.comp.wcBracket")}
              rounds={("R16 QF SF F".split(" "))
                .filter((s) => knockout.some((f) => f.stage === s))
                .map((s) => ({
                  label: t(`game.comp.stage.${s}`),
                  matches: knockout
                    .filter((f) => f.stage === s)
                    .map((f) => ({ id: f.id, home: f.home, away: f.away, score: f.score, status: f.status, winner: f.winner })),
                }))}
            />
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Main view ───────────────────────────────────────────────────

export default function CompetitionsView() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <CinemaHeader
        title={t("game.nav.competitions")}
        subtitle={t("game.cinema.competitions")}
        image="/images/trophy-gold.jpg"
        icon={Trophy}
      />

      <Tabs defaultValue="standings">
        <TabsList className="h-auto min-h-9 flex-wrap">
          <TabsTrigger value="standings" className="min-h-9">{t("game.comp.tab.standings")}</TabsTrigger>
          <TabsTrigger value="fixtures" className="min-h-9">{t("game.comp.tab.fixtures")}</TabsTrigger>
          <TabsTrigger value="calendar" className="min-h-9">{t("game.comp.tab.calendar")}</TabsTrigger>
          <TabsTrigger value="cups" className="min-h-9">{t("game.comp.tab.cups")}</TabsTrigger>
          <TabsTrigger value="worldcup" className="min-h-9">{t("game.comp.tab.worldcup")}</TabsTrigger>
        </TabsList>
        <TabsContent value="standings" className="mt-4">
          <StandingsTab />
        </TabsContent>
        <TabsContent value="fixtures" className="mt-4">
          <FixturesTab />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <CalendarTab />
        </TabsContent>
        <TabsContent value="cups" className="mt-4">
          <CupsTab />
        </TabsContent>
        <TabsContent value="worldcup" className="mt-4">
          <WorldCupTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
