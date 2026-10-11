"use client";
// Knight FM — pre-match briefing card (October, KMIE v3).
// "Informe previo": next fixture (VS rival + kickoff + competition chip),
// the deterministic match-day environment chips (CLIMA/CÉSPED/ASISTENCIA/
// ÁRBITRO — labels reused from the game.* namespace), club spirit bars and
// environment-derived coaching tips. The environment shown here is the SAME
// deterministic draw the engine will use at kickoff (fixtureEnvironment).

import {
  CloudSun,
  Gavel,
  Lightbulb,
  Newspaper,
  Sprout,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useBriefing } from "./use-tactics";

interface MatchBriefingProps {
  clubId: string;
  /** Our club's name (VS row). */
  clubName: string;
}

/** Referee strictness bands (KMIE v3): ≤95 lenient, ≤115 normal, ≤125 strict, else veryStrict. */
function refereeLabelKey(strictness: number): string {
  if (strictness <= 95) return "game.comp.referee.lenient";
  if (strictness <= 115) return "game.comp.referee.normal";
  if (strictness <= 125) return "game.comp.referee.strict";
  return "game.comp.referee.veryStrict";
}

/** Weather/pitch-derived coaching tips (max 3, priority order). */
function tipKeys(weather: string, pitch: string, strictness: number): string[] {
  const tips: string[] = [];
  if (pitch === "WATERLOGGED") tips.push("tactics.briefing.tip.waterlogged");
  if (weather === "SNOW" || weather === "SLEET" || pitch === "SNOWY") tips.push("tactics.briefing.tip.snow");
  if (weather === "STORM") tips.push("tactics.briefing.tip.storm");
  else if (weather === "RAIN") tips.push("tactics.briefing.tip.rain");
  if (pitch === "MUD") tips.push("tactics.briefing.tip.mud");
  if (weather === "HEAT") tips.push("tactics.briefing.tip.heat");
  if (weather === "FOG") tips.push("tactics.briefing.tip.fog");
  if (weather === "WIND") tips.push("tactics.briefing.tip.wind");
  if (strictness > 125) tips.push("tactics.briefing.tip.strictRef");
  const unique = [...new Set(tips)].slice(0, 3);
  return unique.length > 0 ? unique : ["tactics.briefing.tip.none"];
}

export function MatchBriefing({ clubId, clubName }: MatchBriefingProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const briefingQ = useBriefing(clubId);
  const data = briefingQ.data;

  return (
    <section aria-label={t("tactics.briefing.title")} className="rounded-xl border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <Newspaper className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{t("tactics.briefing.title")}</h2>
      </header>

      <div className="flex flex-col gap-3 px-3 py-3">
        {briefingQ.isLoading && (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        )}

        {briefingQ.isError && (
          <p className="text-[13px] text-muted-foreground">
            {briefingQ.error instanceof Error ? briefingQ.error.message : t("err.generic")}
          </p>
        )}

        {data && !data.fixture && (
          <p className="py-2 text-center text-[13px] text-muted-foreground">
            {t("tactics.briefing.noFixture")}
          </p>
        )}

        {data?.fixture && (
          <>
            {/* VS row */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {data.fixture.homeAway === "home" ? clubName : data.fixture.rivalName}
                </span>
                <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                  {t("tactics.briefing.vs")}
                </span>
                <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold">
                  {data.fixture.homeAway === "home" ? data.fixture.rivalName : clubName}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {t(`comp.${data.fixture.competition}`)}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {t(`tactics.briefing.homeAway.${data.fixture.homeAway}`)}
                </Badge>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDate(data.fixture.kickoffUtc)}
                </span>
              </div>
            </div>

            {/* Environment chips (labels reused from game.comp.env.*) */}
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("tactics.briefing.env.title")}
              </h3>
              <div className="grid grid-cols-2 gap-1.5">
                <span className="flex items-center gap-1.5 rounded-lg border bg-background/50 px-2 py-1.5 text-[11px]">
                  <CloudSun aria-hidden="true" className="size-3.5 shrink-0 text-sky-300" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {t("game.comp.env.weather")}
                  </span>
                  <span className="truncate font-semibold">
                    {t(`game.weather.${data.env.weather}`)}
                  </span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {data.env.temperature}°C
                  </span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border bg-background/50 px-2 py-1.5 text-[11px]">
                  <Sprout aria-hidden="true" className="size-3.5 shrink-0 text-emerald-400" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {t("game.comp.env.pitch")}
                  </span>
                  <span className="truncate font-semibold">{t(`game.pitch.${data.env.pitch}`)}</span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border bg-background/50 px-2 py-1.5 text-[11px]">
                  <Users aria-hidden="true" className="size-3.5 shrink-0 text-amber-300" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {t("game.comp.env.attendance")}
                  </span>
                  <span className="truncate font-mono font-semibold tabular-nums">
                    {data.env.attendance != null
                      ? formatNumber(data.env.attendance, { useGrouping: true })
                      : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 rounded-lg border bg-background/50 px-2 py-1.5 text-[11px]">
                  <Gavel aria-hidden="true" className="size-3.5 shrink-0 text-rose-300" />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {t("game.comp.env.referee")}
                  </span>
                  <span className="truncate font-semibold">{t(refereeLabelKey(data.env.referee))}</span>
                </span>
              </div>
            </div>

            {/* Club spirit bars */}
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("tactics.briefing.spirit.title")}
              </h3>
              <div className="space-y-1.5">
                <SpiritBar
                  label={t("tactics.briefing.spirit.spirit")}
                  value={data.club.spirit}
                  color="bg-primary"
                />
                <SpiritBar
                  label={t("tactics.briefing.spirit.atmosphere")}
                  value={data.club.fanHappiness}
                  color="bg-amber-400"
                />
                <SpiritBar
                  label={t("tactics.briefing.spirit.fans")}
                  value={data.env.attendanceFill ?? data.club.fanHappiness}
                  color="bg-sky-400"
                />
              </div>
            </div>

            {/* Rival snapshot */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">{t("tactics.briefing.rivalFormation")}:</span>
              {data.rival.formation ? (
                <Badge variant="outline" className="font-mono text-[11px] text-amber-300">
                  {data.rival.formation}
                </Badge>
              ) : (
                <span className="text-[11px] text-muted-foreground">{t("tactics.briefing.rivalUnknown")}</span>
              )}
              {data.rival.position != null && (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {t("tactics.briefing.position", { n: data.rival.position })}
                </Badge>
              )}
              {data.club.position != null && (
                <Badge variant="outline" className="text-[10px] tabular-nums">
                  {t("tactics.briefing.position", { n: data.club.position })}
                </Badge>
              )}
            </div>

            {/* Environment-derived tips */}
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                {t("tactics.briefing.tips.title")}
              </h3>
              <ul className="flex flex-col gap-1">
                {tipKeys(data.env.weather, data.env.pitch, data.env.referee).map((key) => (
                  <li key={key} className="flex items-start gap-1.5 text-[12px] leading-snug text-foreground/90">
                    <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                    {t(key)}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SpiritBar({ label, value, color }: { label: string; value: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2" title={`${label}: ${clamped}/100`}>
      <span className="w-16 shrink-0 truncate text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${clamped}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {clamped}
      </span>
    </div>
  );
}
