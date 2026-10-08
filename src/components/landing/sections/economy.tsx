"use client";
// Section 9 — Economy & $Knight: separate ledgers, 10% levy, 5%+5% allocations,
// Solana as the only external boundary, token risk disclosure, whitepaper CTA.

import { BookOpen, Coins, Globe, Landmark, Percent, TriangleAlert, Wallet } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

export function Economy() {
  const { t } = useI18n();

  return (
    <SectionTracker
      event={EV.economyView}
      id="economy"
      labelledBy="economy-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.economy.kicker"
          titleKey="landing.economy.title"
          subtitleKey="landing.economy.subtitle"
          headingId="economy-title"
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {/* Ledgers */}
          <div className="grid gap-6">
            <Reveal>
              <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <span className="mb-1 grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                    <Landmark aria-hidden="true" className="size-5 text-primary" />
                  </span>
                  <CardTitle className="text-base">{t("landing.economy.ledger1Title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("landing.economy.ledger1Desc")}</p>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={0.06}>
              <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <span className="mb-1 grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                    <Wallet aria-hidden="true" className="size-5 text-primary" />
                  </span>
                  <CardTitle className="text-base">{t("landing.economy.ledger2Title")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("landing.economy.ledger2Desc")}</p>
                </CardContent>
              </Card>
            </Reveal>
          </div>

          {/* Levy + allocations */}
          <div className="grid content-start gap-6">
            <Reveal delay={0.1}>
              <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <span className="mb-1 grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                    <Percent aria-hidden="true" className="size-5 text-primary" />
                  </span>
                  <CardTitle className="text-base">{t("landing.economy.levy")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("landing.economy.levyDesc")}</p>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={0.16}>
              <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                <CardHeader className="pb-2">
                  <span className="mb-1 grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                    <Coins aria-hidden="true" className="size-5 text-primary" />
                  </span>
                  <CardTitle className="text-base">{t("landing.economy.alloc")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{t("landing.economy.allocDesc")}</p>
                </CardContent>
              </Card>
            </Reveal>
          </div>

          {/* Solana boundary + token risk */}
          <div className="grid content-start gap-6">
            <Reveal delay={0.2}>
              <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                <CardContent className="flex items-start gap-3 pt-6">
                  <Globe aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
                  <p className="text-sm font-medium leading-relaxed">{t("landing.economy.solana")}</p>
                </CardContent>
              </Card>
            </Reveal>
            <Reveal delay={0.26}>
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
                <div className="flex items-start gap-3">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-amber-500" />
                  <div>
                    <h3 className="text-sm font-semibold">{t("landing.economy.riskTitle")}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t("landing.economy.risk")}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Whitepaper */}
        <Reveal delay={0.3} className="mt-10 text-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => track(EV.whitepaper, { target: "economy-whitepaper" })}
          >
            <BookOpen aria-hidden="true" className="size-4" />
            {t("landing.economy.whitepaper")}
          </Button>
        </Reveal>
      </div>
    </SectionTracker>
  );
}
