"use client";
// Section 2 — Value proposition: three expandable pillars (persistent world,
// causal KMIE simulation, no pay-to-win).

import { useState } from "react";
import { Ban, ChevronDown, Cpu, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

const PILLARS = [
  {
    icon: Globe,
    titleKey: "landing.value.pillar1.title",
    bodyKey: "landing.value.pillar1.body",
    moreKey: "landing.value.pillar1.more",
  },
  {
    icon: Cpu,
    titleKey: "landing.value.pillar2.title",
    bodyKey: "landing.value.pillar2.body",
    moreKey: "landing.value.pillar2.more",
  },
  {
    icon: Ban,
    titleKey: "landing.value.pillar3.title",
    bodyKey: "landing.value.pillar3.body",
    moreKey: "landing.value.pillar3.more",
  },
] as const;

export function ValueProposition() {
  const { t } = useI18n();
  const [open, setOpen] = useState<boolean[]>([false, false, false]);

  const toggle = (index: number) => {
    setOpen((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      // Fire only when expanding (not collapsing).
      if (next[index]) track(EV.valuePillarExpand, { pillar: index + 1 });
      return next;
    });
  };

  return (
    <SectionTracker
      event={EV.valuePillarView}
      id="value"
      labelledBy="value-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.value.kicker"
          titleKey="landing.value.title"
          subtitleKey="landing.value.subtitle"
          headingId="value-title"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PILLARS.map((pillar, i) => {
            const expanded = open[i];
            const Icon = pillar.icon;
            const moreId = `pillar-${i + 1}-more`;
            return (
              <Reveal key={pillar.titleKey} delay={i * 0.08}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader>
                    <span className="mb-2 grid size-11 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                      <Icon aria-hidden="true" className="size-5 text-primary" />
                    </span>
                    <h3 className="text-lg font-semibold leading-snug">{t(pillar.titleKey)}</h3>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(pillar.bodyKey)}</p>
                    {expanded ? (
                      <p
                        id={moreId}
                        className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-muted-foreground"
                      >
                        {t(pillar.moreKey)}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-4 -ml-2 gap-1.5 text-primary hover:text-primary"
                      aria-expanded={expanded}
                      aria-controls={moreId}
                      onClick={() => toggle(i)}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                      />
                      {expanded ? t("landing.value.collapse") : t("landing.value.expand")}
                    </Button>
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
