"use client";
// Section 7 — Five themes: live preview cards. Clicking applies the theme via
// useTheme().setTheme — that is the product behavior — and fires analytics.

import { Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/components/theme-provider";
import { THEMES } from "@/lib/themes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

export function FiveThemes() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <SectionTracker
      event={EV.themesView}
      id="themes"
      labelledBy="themes-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.themes.kicker"
          titleKey="landing.themes.title"
          subtitleKey="landing.themes.subtitle"
          headingId="themes-title"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((th, i) => {
            const active = theme === th.id;
            const [bg, primary, accent] = th.swatch;
            return (
              <Reveal key={th.id} delay={i * 0.06}>
                <Card
                  className={`flex h-full flex-col overflow-hidden transition-all ${
                    active ? "ring-2 ring-primary" : "hover:border-primary/40"
                  }`}
                >
                  {/* Mini live preview */}
                  <div className="p-4 pb-0">
                    <div
                      aria-hidden="true"
                      className="flex h-36 flex-col justify-between rounded-lg border border-white/10 p-3"
                      style={{ backgroundColor: bg }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="h-1.5 w-12 rounded-full bg-white/25" />
                        <span className="h-1.5 w-6 rounded-full bg-white/15" />
                      </div>
                      <div className="space-y-1.5">
                        <span className="block h-1.5 w-3/4 rounded-full bg-white/15" />
                        <span className="block h-1.5 w-1/2 rounded-full bg-white/10" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className="rounded-md px-2.5 py-1 text-[10px] font-bold"
                          style={{ backgroundColor: primary, color: bg }}
                        >
                          KNIGHT FM
                        </span>
                        <span className="text-sm font-extrabold" style={{ color: accent }}>
                          Aa
                        </span>
                      </div>
                    </div>
                  </div>

                  <CardContent className="flex-1 pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{t(th.nameKey)}</h3>
                      {active ? <Badge className="bg-primary/15 text-primary">{t("landing.themes.active")}</Badge> : null}
                    </div>
                    <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
                      {th.swatch.map((c) => (
                        <span
                          key={c}
                          className="size-4 rounded-full border border-white/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      type="button"
                      variant={active ? "secondary" : "outline"}
                      className="w-full"
                      aria-pressed={active}
                      onClick={() => {
                        setTheme(th.id);
                        track(EV.themePreview, { theme: th.id });
                      }}
                    >
                      {active ? <Check aria-hidden="true" className="size-4" /> : null}
                      {t("landing.themes.cta")}
                    </Button>
                  </CardFooter>
                </Card>
              </Reveal>
            );
          })}

          {/* Hint tile */}
          <Reveal delay={0.3}>
            <div className="flex h-full min-h-40 flex-col justify-center rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("landing.themes.hint")}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </SectionTracker>
  );
}
