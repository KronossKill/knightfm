"use client";
// Section 3 — How it works: four numbered steps (register → choose path →
// manage & compete → build a legacy) with lucide icons and step-click analytics.

import { Crown, Split, Swords, UserPlus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

const STEPS = [
  { icon: UserPlus, titleKey: "landing.how.step1.title", descKey: "landing.how.step1.desc" },
  { icon: Split, titleKey: "landing.how.step2.title", descKey: "landing.how.step2.desc" },
  { icon: Swords, titleKey: "landing.how.step3.title", descKey: "landing.how.step3.desc" },
  { icon: Crown, titleKey: "landing.how.step4.title", descKey: "landing.how.step4.desc" },
] as const;

export function HowItWorks() {
  const { t } = useI18n();

  return (
    <SectionTracker
      event={EV.howView}
      id="how-it-works"
      labelledBy="how-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.how.kicker"
          titleKey="landing.how.title"
          subtitleKey="landing.how.subtitle"
          headingId="how-title"
        />

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li key={step.titleKey}>
                <Reveal delay={i * 0.08} className="h-full">
                  <Card
                    role="button"
                    tabIndex={0}
                    aria-label={t("landing.how.stepLabel", { n: i + 1 })}
                    className="relative h-full cursor-pointer overflow-hidden transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => track(EV.stepClick, { step: i + 1 })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        track(EV.stepClick, { step: i + 1 });
                      }
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-2 text-5xl font-black text-primary/10"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <CardContent className="pt-6">
                      <span className="mb-4 grid size-11 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                        <Icon aria-hidden="true" className="size-5 text-primary" />
                      </span>
                      <p className="text-xs font-semibold uppercase tracking-widest gold-accent">
                        {t("landing.how.stepLabel", { n: i + 1 })}
                      </p>
                      <h3 className="mt-1.5 text-lg font-semibold">{t(step.titleKey)}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(step.descKey)}</p>
                    </CardContent>
                  </Card>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </div>
    </SectionTracker>
  );
}
