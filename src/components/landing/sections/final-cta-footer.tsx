"use client";
// Section 12 — Final CTA + Footer: last registration call, footer navigation,
// legal links, language/theme selectors and the responsible-use notice.

import { ArrowRight, Download, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { KnightLogo } from "@/components/knight-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "../reveal";
import { SectionTracker } from "../analytics-tracker";
import { LanguageSelect, ThemeSelect } from "../controls";
import { EV, track } from "../analytics";
import { LEGAL_LINKS } from "./security-trust";

const NAV_LINKS = [
  { id: "how-it-works", key: "landing.nav.how" },
  { id: "kmie", key: "landing.nav.kmie" },
  { id: "world", key: "landing.nav.world" },
  { id: "themes", key: "landing.nav.themes" },
  { id: "economy", key: "landing.nav.economy" },
  { id: "security", key: "landing.nav.security" },
] as const;

interface FinalCtaProps {
  onPrimaryCta?: () => void;
  /** Smooth-scroll helper provided by the Landing root. */
  scrollTo?: (id: string) => void;
}

export function FinalCta({ onPrimaryCta, scrollTo }: FinalCtaProps) {
  const { t } = useI18n();

  return (
    <SectionTracker
      event={EV.finalView}
      id="get-started"
      labelledBy="final-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <Card className="relative overflow-hidden border-primary/25 text-center">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(70% 90% at 50% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
              }}
            />
            <CardContent className="relative p-8 sm:p-12">
              <h2
                id="final-title"
                className="text-balance text-3xl font-extrabold tracking-tight sm:text-4xl"
              >
                {t("landing.final.title")}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground sm:text-lg">
                {t("landing.final.subtitle")}
              </p>
              <Button
                type="button"
                size="lg"
                className="mt-8 h-11 px-8 text-base font-semibold shadow-lg shadow-primary/20"
                onClick={() => {
                  track(EV.finalSubmit);
                  onPrimaryCta?.();
                }}
              >
                {t("landing.final.cta")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">{t("landing.final.note")}</p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </SectionTracker>
  );
}

export function LandingFooter({ scrollTo }: { scrollTo?: (id: string) => void }) {
  const { t } = useI18n();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <KnightLogo size={40} eager />
              <span className="text-sm font-extrabold uppercase tracking-[0.28em]">
                Knight <span className="gold-accent">FM</span>
              </span>
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">{t("landing.footer.tagline")}</p>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-muted-foreground/80">
              {t("landing.footer.responsible")}
            </p>
          </div>

          {/* Navigation */}
          <nav aria-label={t("landing.footer.navTitle")}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("landing.footer.navTitle")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      track(EV.footerClick, { link: link.id });
                      scrollTo?.(link.id);
                    }}
                  >
                    {t(link.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label={t("landing.footer.legalTitle")}>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("landing.footer.legalTitle")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      track(EV.legalLink, { link: link.id, source: "footer" });
                    }}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(link.key)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Settings */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              {t("landing.footer.settingsTitle")}
            </h3>
            <div className="mt-4 flex flex-col items-start gap-2">
              <LanguageSelect source="footer" />
              <ThemeSelect source="footer" />
            </div>
          </div>
        </div>

        {/* Documentation + source download — Task 45/45-b */}
        <div className="mt-10 rounded-lg border border-border/60 bg-background/40 p-4 sm:p-5">
          <div className="flex items-center gap-4 sm:gap-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" aria-hidden="true">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{t("landing.footer.docs")}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t("landing.footer.docsHint")}</span>
            </span>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a
              href="/downloads/knight-fm-project.zip"
              download
              onClick={() => track(EV.footerClick, { link: "docs-zip" })}
              className="group flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/15"
            >
              <Download className="size-4 text-primary" aria-hidden="true" />
              {t("landing.footer.docsZip")}
            </a>
            <a
              href="/downloads/knight-fm-documentacion.docx"
              download
              onClick={() => track(EV.footerClick, { link: "docs-word" })}
              className="group flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-primary/15"
            >
              <Download className="size-4 text-primary" aria-hidden="true" />
              {t("landing.footer.docsWord")}
            </a>
          </div>
        </div>

        <Separator className="my-8" />
        <p className="text-center text-xs text-muted-foreground">{t("landing.footer.rights", { year })}</p>
      </div>
    </footer>
  );
}
