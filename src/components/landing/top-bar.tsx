"use client";
// Knight FM — slim sticky top bar: logo + language/theme selectors.
// Transparent over the hero; gains backdrop-blur + border once the page scrolls.

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { KnightLogo } from "@/components/knight-logo";
import { LanguageSelect, ThemeSelect } from "./controls";

export function TopBar() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrolled(window.scrollY > 8);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 w-full transition-colors duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/70 backdrop-blur-md supports-[backdrop-filter]:bg-background/60"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      {/* Skip link — first focusable element (WCAG AA) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        {t("landing.a11y.skip")}
      </a>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand crest + wordmark */}
        <div className="flex items-center gap-2.5">
          <KnightLogo size={40} priority />
          <span className="text-sm font-extrabold uppercase tracking-[0.28em] sm:text-base">
            Knight <span className="gold-accent">FM</span>
          </span>
        </div>

        {/* Selectors */}
        <div className="flex items-center gap-1">
          <LanguageSelect source="top" />
          <ThemeSelect source="top" />
        </div>
      </div>
    </header>
  );
}
