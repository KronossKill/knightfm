"use client";
// Section 1 — Hero: official headline set, CTAs, trust badges, LIVE presence
// indicator (graceful "—" fallback, never fabricated) and the tactical board mockup.

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Play, ScrollText, Shield, ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionTracker } from "../analytics-tracker";
import { TacticalBoard } from "../tactical-board";
import { KnightLogo } from "@/components/knight-logo";
import { EV, track } from "../analytics";

interface HeroProps {
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
}

/** Defensive parse of /api/presence/summary — only real numbers are shown. */
function extractActiveManagers(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const candidates = ["activeManagers", "managers", "online", "active", "count"];
  const record = data as Record<string, unknown>;
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  }
  return null;
}

export function Hero({ onPrimaryCta, onSecondaryCta }: HeroProps) {
  const { t, formatNumber } = useI18n();
  const [presence, setPresence] = useState<number | null>(null);

  // LIVE indicator: poll /api/presence/summary every 60 s. Missing endpoint,
  // non-OK status or unexpected shape → keep "—" (never fabricate numbers).
  const load = useCallback(() => {
    fetch("/api/presence/summary", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`presence ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        const n = extractActiveManagers(data);
        if (n !== null) setPresence(n);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const trust = [
    { icon: ShieldCheck, key: "landing.hero.trust.wcag" },
    { icon: Shield, key: "landing.hero.trust.turnstile" },
    { icon: ScrollText, key: "landing.hero.trust.audit" },
  ] as const;

  return (
    <SectionTracker event={EV.heroView} id="hero" labelledBy="hero-title" className="relative overflow-hidden">
      {/* Backdrop: emerald glow + faint grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px]"
        style={{
          background:
            "radial-gradient(58% 60% at 50% 0%, color-mix(in oklab, var(--primary) 13%, transparent), transparent 72%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(80% 62% at 50% 0%, black, transparent)",
          WebkitMaskImage: "radial-gradient(80% 62% at 50% 0%, black, transparent)",
        }}
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-24 lg:pt-24">
        {/* Copy */}
        <div>
          <Reveal>
            <KnightLogo
              size={120}
              priority
              className="drop-shadow-[0_12px_48px_rgba(16,185,129,0.35)]"
            />
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] gold-accent">{t("landing.hero.kicker")}</p>
            <h1
              id="hero-title"
              className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
            >
              {t("landing.hero.headline")}
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
              {t("landing.hero.subtitle")}
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                size="lg"
                className="h-11 px-6 text-base font-semibold shadow-lg shadow-primary/20"
                onClick={() => {
                  track(EV.heroCtaPrimary);
                  onPrimaryCta?.();
                }}
              >
                {t("landing.hero.ctaPrimary")}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="h-11 px-6 text-base"
                onClick={() => onSecondaryCta?.()}
              >
                <Play aria-hidden="true" className="size-4" />
                {t("landing.hero.ctaSecondary")}
              </Button>
            </div>
          </Reveal>

          {/* LIVE presence indicator */}
          <Reveal delay={0.14}>
            <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-card/60 px-4 py-2">
              <span className="relative flex size-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
              </span>
              <span className="text-sm text-muted-foreground">{t("landing.hero.live.label")}</span>
              <span className="text-sm font-bold tabular-nums" aria-live="polite">
                {presence !== null ? formatNumber(presence) : "—"}
              </span>
            </div>
          </Reveal>

          {/* Trust badges */}
          <Reveal delay={0.2}>
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {trust.map(({ icon: Icon, key }) => (
                <li key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon aria-hidden="true" className="size-4 text-primary" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Tactical board mockup */}
        <Reveal delay={0.12} className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-6 -z-10 rounded-3xl opacity-70 blur-2xl"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 40%, color-mix(in oklab, var(--primary) 24%, transparent), transparent)",
            }}
          />
          <Card className="mx-auto max-w-sm border-primary/20 lg:-rotate-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{t("landing.hero.board.title")}</CardTitle>
                <Badge variant="outline" className="gold-accent border-primary/40">
                  {t("landing.hero.board.badge")}
                </Badge>
              </div>
              <CardDescription>{t("landing.hero.board.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <TacticalBoard />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </SectionTracker>
  );
}
