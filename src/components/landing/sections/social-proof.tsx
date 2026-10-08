"use client";
// Section 10 — Social proof: honest product facts ONLY (no fabricated
// testimonials or user counts — spec forbids). Real world numbers + principles.

import { BadgeCheck, Info, ShieldCheck, Swords, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV } from "../analytics";

const PRINCIPLES = [
  "landing.proof.principle1",
  "landing.proof.principle2",
  "landing.proof.principle3",
] as const;

export function SocialProof() {
  const { t, formatNumber } = useI18n();

  const facts = [
    { icon: Users, value: formatNumber(1600), label: t("landing.proof.clubs") },
    { icon: ShieldCheck, value: `${formatNumber(32000)}+`, label: t("landing.proof.players") },
    { icon: Swords, value: formatNumber(24800), label: t("landing.proof.fixtures") },
  ];

  return (
    <SectionTracker
      event={EV.proofView}
      id="proof"
      labelledBy="proof-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.proof.kicker"
          titleKey="landing.proof.title"
          subtitleKey="landing.proof.subtitle"
          headingId="proof-title"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {facts.map((fact, i) => {
            const Icon = fact.icon;
            return (
              <Reveal key={fact.label} delay={i * 0.08}>
                <Card className="h-full border-primary/15 text-center transition-colors hover:border-primary/40">
                  <CardContent className="flex h-full flex-col items-center justify-center gap-2 p-6">
                    <Icon aria-hidden="true" className="size-6 text-primary" />
                    <span className="text-4xl font-extrabold tabular-nums tracking-tight">{fact.value}</span>
                    <span className="text-sm text-muted-foreground">{fact.label}</span>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={0.2}>
          <ul className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
            {PRINCIPLES.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-muted-foreground">
                <BadgeCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {t(key)}
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-8 flex max-w-2xl items-start justify-center gap-2 text-center text-xs text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t("landing.proof.honest")}
          </p>
        </Reveal>
      </div>
    </SectionTracker>
  );
}
