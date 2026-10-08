"use client";
// Section 5 — KMIE: the 10-minute live match (4 min + 2 min halftime + 4 min),
// stylized CSS timeline, xG-like metric chips and a "watch replay" CTA.

import { CircleDot, Eye, Play } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

interface KmieProps {
  onPrimaryCta?: () => void;
}

const FACT_KEYS = ["landing.kmie.fact1", "landing.kmie.fact2", "landing.kmie.fact3"] as const;

export function Kmie({ onPrimaryCta }: KmieProps) {
  const { t, formatNumber } = useI18n();

  const chips = [
    { label: t("landing.kmie.chip.possession"), home: `${formatNumber(58)}%`, away: `${formatNumber(42)}%` },
    { label: t("landing.kmie.chip.shots"), home: formatNumber(14), away: formatNumber(9) },
    {
      label: t("landing.kmie.chip.chance"),
      home: formatNumber(3.1, { maximumFractionDigits: 1 }),
      away: formatNumber(1.8, { maximumFractionDigits: 1 }),
    },
  ];

  return (
    <SectionTracker
      event={EV.kmieView}
      id="kmie"
      labelledBy="kmie-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.kmie.kicker"
          titleKey="landing.kmie.title"
          subtitleKey="landing.kmie.subtitle"
          headingId="kmie-title"
        />

        {/* Stylized match timeline: 4' + 2' HT + 4' */}
        <Reveal delay={0.08} className="mt-12">
          <Card className="border-primary/20 bg-card/60">
            <CardContent className="pt-6">
              <div
                className="flex h-20 w-full overflow-hidden rounded-lg border"
                role="img"
                aria-label={t("landing.kmie.total")}
              >
                <div className="flex w-2/5 flex-col items-start justify-center gap-1 border-r border-border/60 bg-primary/15 px-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary sm:text-sm">
                    {t("landing.kmie.stage1")}
                  </span>
                  <span className="text-sm font-bold tabular-nums sm:text-lg">
                    {t("landing.kmie.min", { n: 4 })}
                  </span>
                </div>
                <div className="flex w-1/5 flex-col items-center justify-center gap-1 bg-muted/70">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("landing.kmie.stageHT")}
                  </span>
                  <span className="text-sm font-bold tabular-nums text-muted-foreground">
                    {t("landing.kmie.min", { n: 2 })}
                  </span>
                </div>
                <div className="flex w-2/5 flex-col items-end justify-center gap-1 border-l border-border/60 bg-primary/15 px-4 text-right">
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary sm:text-sm">
                    {t("landing.kmie.stage2")}
                  </span>
                  <span className="text-sm font-bold tabular-nums sm:text-lg">
                    {t("landing.kmie.min", { n: 4 })}
                  </span>
                </div>
              </div>

              {/* Minute scale 0' / 4' / 6' / 10' */}
              <div className="relative mt-2 h-5 text-xs tabular-nums text-muted-foreground">
                <span className="absolute left-0">0′</span>
                <span className="absolute left-2/5 -translate-x-1/2">4′</span>
                <span className="absolute left-3/5 -translate-x-1/2">6′</span>
                <span className="absolute right-0">10′</span>
              </div>

              <p className="mt-2 text-center text-sm font-medium text-muted-foreground">{t("landing.kmie.total")}</p>
            </CardContent>
          </Card>
        </Reveal>

        {/* xG-like metric chips (illustrative) */}
        <Reveal delay={0.14} className="mt-6">
          <p className="mb-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Eye aria-hidden="true" className="size-3.5" />
            {t("landing.kmie.illustrative")}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {chips.map((chip) => (
              <div
                key={chip.label}
                className="flex items-center justify-between rounded-lg border bg-card/60 px-4 py-3"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {chip.label}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  <span className="text-primary">{chip.home}</span>
                  <span className="mx-1.5 text-muted-foreground">—</span>
                  <span>{chip.away}</span>
                </span>
              </div>
            ))}
          </div>
        </Reveal>

        {/* Facts + replay CTA */}
        <Reveal delay={0.2} className="mt-10">
          <ul className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
            {FACT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CircleDot aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {t(key)}
              </li>
            ))}
          </ul>
          <div className="mt-8 text-center">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 px-6"
              onClick={() => {
                track(EV.kmieReplay);
                onPrimaryCta?.();
              }}
            >
              <Play aria-hidden="true" className="size-4" />
              {t("landing.kmie.replay")}
            </Button>
          </div>
        </Reveal>
      </div>
    </SectionTracker>
  );
}
