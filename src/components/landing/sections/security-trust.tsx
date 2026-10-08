"use client";
// Section 11 — Security & trust: six protection cards + legal links row
// (href="#" placeholders wired later; each click fires landing_legal_link_click).

import { Accessibility, KeyRound, MailCheck, RefreshCw, ScrollText, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";

const CARDS = [
  { icon: KeyRound, titleKey: "landing.security.argon2.title", descKey: "landing.security.argon2.desc" },
  { icon: RefreshCw, titleKey: "landing.security.jwt.title", descKey: "landing.security.jwt.desc" },
  { icon: ShieldCheck, titleKey: "landing.security.turnstile.title", descKey: "landing.security.turnstile.desc" },
  { icon: MailCheck, titleKey: "landing.security.email.title", descKey: "landing.security.email.desc" },
  { icon: ScrollText, titleKey: "landing.security.audit.title", descKey: "landing.security.audit.desc" },
  { icon: Accessibility, titleKey: "landing.security.wcag.title", descKey: "landing.security.wcag.desc" },
] as const;

const LEGAL_LINKS = [
  { id: "privacy", key: "landing.legal.privacy" },
  { id: "terms", key: "landing.legal.terms" },
  { id: "cookies", key: "landing.legal.cookies" },
  { id: "play", key: "landing.legal.play" },
  { id: "refunds", key: "landing.legal.refunds" },
  { id: "token", key: "landing.legal.token" },
] as const;

export function SecurityTrust() {
  const { t } = useI18n();

  return (
    <SectionTracker
      event={EV.securityView}
      id="security"
      labelledBy="security-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.security.kicker"
          titleKey="landing.security.title"
          subtitleKey="landing.security.subtitle"
          headingId="security-title"
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.titleKey} delay={i * 0.06}>
                <Card className="h-full border-primary/15 transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <span className="mb-1 grid size-10 place-items-center rounded-lg border border-primary/25 bg-primary/10">
                      <Icon aria-hidden="true" className="size-5 text-primary" />
                    </span>
                    <CardTitle className="text-base">{t(card.titleKey)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">{t(card.descKey)}</p>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </div>

        {/* Legal links row */}
        <Reveal delay={0.2}>
          <nav aria-label={t("landing.footer.legalTitle")} className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t pt-8">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link.id}
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  track(EV.legalLink, { link: link.id });
                }}
                className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                {t(link.key)}
              </a>
            ))}
          </nav>
        </Reveal>
      </div>
    </SectionTracker>
  );
}

export { LEGAL_LINKS };
