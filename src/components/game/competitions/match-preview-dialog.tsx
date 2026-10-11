"use client";
// Knight FM — KMIE v3 PRE-MATCH card (user mandate: "El motor del partido debe
// estar bien definido y las tarjetas identificar todas las características del
// próximo partido").
//
// Every characteristic shown here is DETERMINISTIC from the fixture seed and
// identical to what the engine consumes at kickoff: weather, home pitch,
// temperature/wind/humidity, both clubs' expected XI, morale, confidence,
// form, stakes, gate economics and the exact Poisson forecast. The forecast is
// labelled as a probabilistic model — never a promise (honesty rule).

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CloudSun,
  Crown,
  Flame,
  Gauge,
  Goal,
  HandCoins,
  Hospital,
  Leaf,
  Sprout,
  Thermometer,
  Timer,
  Trophy,
  Users,
  Wind,
} from "lucide-react";
import "@/lib/i18n/dict/game";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { fetchMatchPreview, qk, type FixtureRow, type MatchPreview, type MatchPreviewSide } from "@/components/game/api";
import { BrandBadge, ErrorState } from "@/components/game/ui/bits";
import { CountryFlag } from "@/components/game/ui/country-flag";
import { ClubSquadDialog } from "@/components/game/competitions/club-squad-dialog";
import { cn } from "@/lib/utils";

const WEATHER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CLEAR: CloudSun,
  CLOUDY: CloudSun,
  OVERCAST: CloudSun,
  LIGHT_RAIN: CloudSun,
  HEAVY_RAIN: CloudSun,
  STORM: CloudSun,
  WINDY: Wind,
  FOG: CloudSun,
  SNOW: CloudSun,
  HEAT: Thermometer,
  HUMID: CloudSun,
};

function PersonLine({ person, roleKey }: { person: { username: string; country: string | null } | null; roleKey: string }) {
  const { t } = useI18n();
  if (!person) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <CountryFlag code={person.country} />
      <span className="text-[10px] text-muted-foreground">
        {t(roleKey)}: {person.username}
      </span>
    </span>
  );
}

function FormDots({ form }: { form: string[] }) {
  const { t } = useI18n();
  if (form.length === 0) return <span className="text-[10px] text-muted-foreground">{t("preview.noMatchesYet")}</span>;
  return (
    <span className="inline-flex gap-0.5" aria-label={t("preview.form")}>
      {form.map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex size-4 items-center justify-center rounded-sm text-[9px] font-bold",
            r === "W" && "bg-primary/20 text-primary",
            r === "D" && "bg-muted text-muted-foreground",
            r === "L" && "bg-destructive/15 text-destructive"
          )}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function SidePanel({ side, align = "left" }: { side: MatchPreviewSide; align?: "left" | "right" }) {
  const { t } = useI18n();
  return (
    <div className={cn("min-w-0 flex-1 space-y-2 text-center", align === "right" && "text-right")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <BrandBadge brand={side.brand} name={side.name} size="md" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{side.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {t("preview.division", { n: side.divisionIndex })} · {side.formation}
          </p>
        </div>
      </div>

      <div className={cn("flex items-center gap-1", align === "right" && "justify-end")}>
        <PersonLine person={side.owner} roleKey="preview.owner" />
        <PersonLine person={side.manager} roleKey="preview.manager" />
      </div>

      <div className={cn("flex flex-wrap items-center gap-1.5", align === "right" && "justify-end")}>
        <Badge variant="outline" className="gap-1 border-primary/40 text-[10px] text-primary">
          <Gauge aria-hidden="true" className="size-3" />
          {t("preview.ovr", { n: side.expectedXI.ovr })}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Flame aria-hidden="true" className="size-3 text-amber-400" />
          {t("preview.morale", { n: side.morale })}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px]">
          <Crown aria-hidden="true" className="size-3 text-amber-400" />
          {t("preview.confidence", { n: side.confidence })}
        </Badge>
      </div>

      <div className={cn("flex flex-wrap items-center gap-1.5", align === "right" && "justify-end")}>
        {side.injured > 0 && (
          <Badge variant="outline" className="gap-1 border-destructive/40 text-[10px] text-destructive">
            <Hospital aria-hidden="true" className="size-3" />
            {t("preview.injured", { n: side.injured })}
          </Badge>
        )}
        {side.suspended > 0 && (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-[10px] text-amber-300">
            {t("preview.suspended", { n: side.suspended })}
          </Badge>
        )}
        {side.standings && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Trophy aria-hidden="true" className="size-3" />
            {t("preview.position", { n: side.standings.position, p: side.standings.points })}
          </Badge>
        )}
      </div>

      <div className={cn("flex items-center gap-2", align === "right" && "justify-end")}>
        <FormDots form={side.form} />
      </div>

      {side.topScorer && (
        <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Goal aria-hidden="true" className="size-3 text-primary" />
          {t("preview.topScorer", { name: side.topScorer.name, goals: side.topScorer.goals })}
        </p>
      )}
    </div>
  );
}

function ForecastBars({ preview }: { preview: MatchPreview }) {
  const { t } = useI18n();
  const p = preview.prediction!;
  const rows: Array<{ label: string; value: number; color: string }> = [
    { label: t("preview.winHome", { name: preview.home.name }), value: p.homeWin, color: "bg-primary" },
    { label: t("preview.draw"), value: p.draw, color: "bg-muted-foreground" },
    { label: t("preview.winAway", { name: preview.away.name }), value: p.awayWin, color: "bg-amber-500" },
  ];
  return (
    <div className="space-y-2 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("preview.forecast")}</h4>
        <span className="text-[10px] text-muted-foreground">
          xG {p.expectedGoalsHome.toFixed(2)} – {p.expectedGoalsAway.toFixed(2)}
        </span>
      </div>
      {rows.map((r) => (
        <div key={r.label} className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="font-mono font-semibold tabular-nums">{Math.round(r.value * 100)}%</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className={cn("h-full", r.color)} style={{ width: `${r.value * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="flex flex-wrap items-center gap-1 pt-1 text-[10px] text-muted-foreground">
        <Sprout aria-hidden="true" className="size-3" />
        {t("preview.mostLikelyScore")}
        {p.topScorelines.map((s) => `${s.h}-${s.a}`).join(" · ")}
      </p>
      <p className="text-[10px] italic text-muted-foreground/80">{t("preview.forecastNote")}</p>
    </div>
  );
}

export function MatchPreviewDialog({
  fixture,
  open,
  onOpenChange,
}: {
  fixture: Pick<FixtureRow, "id"> | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t, formatDate } = useI18n();
  const [squadClubId, setSquadClubId] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: qk.preview(fixture?.id ?? "none"),
    queryFn: () => fetchMatchPreview(fixture!.id),
    enabled: open && !!fixture,
    staleTime: 30_000,
    retry: false,
  });

  const preview = query.data;
  const WeatherIcon = preview ? (WEATHER_ICON[preview.context.weather] ?? CloudSun) : CloudSun;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer aria-hidden="true" className="size-4 text-primary" />
              {t("preview.title")}
            </DialogTitle>
            {preview && (
              <DialogDescription>
                {t(`comp.${preview.fixture.competition}`)}
                {preview.fixture.isKnockout ? ` · ${t("preview.knockout")}` : ""}
                {preview.fixture.matchDay ? ` · ${t("fixtures.matchday", { n: preview.fixture.matchDay })}` : ""}
                {" · "}
                {formatDate(preview.fixture.kickoffUtc)}
                {" · "}
                {t(preview.fixture.regionNameKey)}
              </DialogDescription>
            )}
          </DialogHeader>

          {query.isLoading && (
            <div className="space-y-3" aria-hidden="true">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          )}

          {query.error && !query.isLoading && (
            <ErrorState message={query.error instanceof Error ? query.error.message : t("err.generic")} onRetry={() => void query.refetch()} />
          )}

          {preview && (
            <div className="space-y-4">
              {/* Kickoff countdown + competition context */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border bg-card/60 px-4 py-2 text-[11px] text-muted-foreground">
                <span>
                  {t("preview.season", { n: preview.fixture.seasonNumber })}
                </span>
                <span>{t(preview.fixture.regionNameKey)}</span>
                {preview.fixture.matchDay > 0 && <span>{t("fixtures.matchday", { n: preview.fixture.matchDay })}</span>}
              </div>

              {/* Conditions: the exact engine inputs */}
              <div className="rounded-xl border p-4">
                <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Leaf aria-hidden="true" className="size-3.5 text-primary" />
                  {t("preview.conditions")}
                </h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <WeatherIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{t(`preview.weather.${preview.context.weather}`)}</p>
                      <p className="text-[10px] text-muted-foreground">{t("preview.weather")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <Sprout aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{t(`preview.pitch.${preview.context.pitch}`)}</p>
                      <p className="text-[10px] text-muted-foreground">{t("preview.pitch")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                    <Thermometer aria-hidden="true" className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{t("preview.temp", { n: preview.context.temperatureC })}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t("preview.humidity", { n: preview.context.humidityPct })} · {t("preview.wind", { n: preview.context.windKmh })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clubs head to head with every side characteristic */}
              <div className="flex flex-col items-stretch justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-start sm:gap-3">
                <SidePanel side={preview.home} />
                <div className="flex shrink-0 flex-col items-center gap-1 pt-2">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">VS</span>
                  <button
                    type="button"
                    className="min-h-11 rounded-md px-2 text-[10px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                    onClick={() => setSquadClubId(preview.home.id)}
                  >
                    {t("game.comp.squad.view")}
                  </button>
                </div>
                <SidePanel side={preview.away} align="right" />
              </div>

              {/* Stakes + economics */}
              <div className="grid grid-cols-1 gap-2 rounded-xl border p-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <HandCoins aria-hidden="true" className="size-3.5 text-primary" />
                    {t("preview.stakes")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t("preview.winPrize", { home: preview.stakes.winPrizeHome, away: preview.stakes.winPrizeAway })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("preview.gate", { min: preview.stakes.gateGross[0], max: preview.stakes.gateGross[1], home: preview.stakes.gateHomeSharePct })}
                  </p>
                </div>
                <div className="space-y-1">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Users aria-hidden="true" className="size-3.5 text-primary" />
                    {t("preview.squads")}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {t("preview.squadState", {
                      hInj: preview.home.injured,
                      hSus: preview.home.suspended,
                      aInj: preview.away.injured,
                      aSus: preview.away.suspended,
                    })}
                  </p>
                </div>
              </div>

              {preview.prediction && <ForecastBars preview={preview} />}
              {preview.fixture.status === "PLAYED" && (
                <p className="text-center text-[11px] text-muted-foreground">{t("preview.alreadyPlayed")}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ClubSquadDialog clubId={squadClubId} open={!!squadClubId} onOpenChange={(v) => !v && setSquadClubId(null)} />
    </>
  );
}
