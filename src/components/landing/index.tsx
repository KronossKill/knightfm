"use client";
// Knight FM — Landing composition (spec §46). 12 sections, analytics wiring,
// i18n namespace registration. page.tsx integration is done by the lead; this
// component only exposes onPrimaryCta (register) / onSecondaryCta callbacks.

import "@/lib/i18n/dict/landing";

import { useCallback, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { useI18n } from "@/lib/i18n";

import { EV, track } from "./analytics";
import { useScrollDepth } from "./analytics-tracker";
import { TopBar } from "./top-bar";
import { Hero } from "./sections/hero";
import { ValueProposition } from "./sections/value-proposition";
import { HowItWorks } from "./sections/how-it-works";
import { Differentiation } from "./sections/differentiation";
import { Kmie } from "./sections/kmie";
import { WorldCompetitions } from "./sections/world-competitions";
import { FiveThemes } from "./sections/five-themes";
import { KnightAssistant } from "./sections/knight-assistant";
import { Economy } from "./sections/economy";
import { SocialProof } from "./sections/social-proof";
import { SecurityTrust } from "./sections/security-trust";
import { FinalCta, LandingFooter } from "./sections/final-cta-footer";

export interface LandingProps {
  /** Opens the register flow (wired by page.tsx later). */
  onPrimaryCta?: () => void;
  /** Secondary hero action (wired by page.tsx later). */
  onSecondaryCta?: () => void;
}

export default function Landing({ onPrimaryCta, onSecondaryCta }: LandingProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    track(EV.view);
  }, []);

  useScrollDepth();

  const scrollTo = useCallback(
    (id: string) => {
      document.getElementById(id)?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [reducedMotion]
  );

  // Hero secondary CTA: fires the event, honors the page callback, then
  // smooth-scrolls to the KMIE section (built-in behavior).
  const handleSecondaryCta = useCallback(() => {
    track(EV.heroCtaSecondary);
    onSecondaryCta?.();
    scrollTo("kmie");
  }, [onSecondaryCta, scrollTo]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main id="main" aria-label={t("app.name")}>
        <Hero onPrimaryCta={onPrimaryCta} onSecondaryCta={handleSecondaryCta} />
        <ValueProposition />
        <HowItWorks />
        <Differentiation />
        <Kmie onPrimaryCta={onPrimaryCta} />
        <WorldCompetitions />
        <FiveThemes />
        <KnightAssistant />
        <Economy />
        <SocialProof />
        <SecurityTrust />
        <FinalCta onPrimaryCta={onPrimaryCta} scrollTo={scrollTo} />
      </main>
      <LandingFooter scrollTo={scrollTo} />
    </div>
  );
}
