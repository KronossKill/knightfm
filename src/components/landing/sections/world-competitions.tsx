"use client";
// Section 6 — World & competitions: the real stat grid (10 regions, 10 divisions
// per region, 1,600 clubs, 30 league fixtures, cups day 29, World Championship
// day 30, season 32 + 5).

import { CalendarDays, Flag, Globe, Hourglass, Layers, Map, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV } from "../analytics";

export function WorldCompetitions() {
  const { t, formatNumber } = useI18n();

  const stats: Array<{ icon: typeof Map; value: string; label: string; wide?: boolean }> = [
    { icon: Map, value: formatNumber(10), label: t("landing.world.regions") },
    { icon: Layers, value: formatNumber(10), label: t("landing.world.divisions") },
    { icon: Users, value: formatNumber(1600), label: t("landing.world.clubs") },
    { icon: CalendarDays, value: formatNumber(30), label: t("landing.world.leagueFixtures") },
    { icon: Flag, value: formatNumber(29), label: t("landing.world.cups") },
    { icon: Globe, value: formatNumber(40), label: t("landing.world.worldCup") },
    { icon: Hourglass, value: `${formatNumber(32)} + ${formatNumber(5)}`, label: t("landing.world.season"), wide: true },
  ];

  return (
    <SectionTracker
      event={EV.worldView}
      id="world"
      labelledBy="world-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.world.kicker"
          titleKey="landing.world.title"
          subtitleKey="landing.world.subtitle"
          headingId="world-title"
        />

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Reveal key={stat.label} delay={i * 0.05} className={stat.wide ? "col-span-2 sm:col-span-3 lg:col-span-2" : undefined}>
                <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col items-start gap-2 p-5 sm:p-6">
                    <Icon aria-hidden="true" className="size-5 text-primary" />
                    <span className="text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">
                      {stat.value}
                    </span>
                    <span className="text-sm leading-snug text-muted-foreground">{stat.label}</span>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </div>
    </SectionTracker>
  );
}
