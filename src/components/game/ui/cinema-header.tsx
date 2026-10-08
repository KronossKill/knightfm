"use client";
// Knight FM — CinemaHeader (Task 56 "Cinematic Realm").
// A photoreal section header: AI-generated cinematic photography sits behind a
// theme-aware gradient veil (+ optional film grain) that always resolves into
// the page background, so the title keeps AA contrast in every theme.
//
// Purely presentational and additive: views render it above their existing
// content. The image is decorative (empty alt + aria-hidden), the h1 keeps
// each view's semantic heading, and the slow Ken-Burns-style drift is disabled
// for prefers-reduced-motion users via CSS.

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type CinemaImage =
  | "/images/stadium-night.jpg"
  | "/images/pitch-dark.jpg"
  | "/images/trophy-gold.jpg"
  | "/images/locker-mood.jpg"
  | "/images/training-dusk.jpg";

export default function CinemaHeader({
  title,
  subtitle,
  image,
  icon: Icon,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  image: CinemaImage;
  icon?: React.ComponentType<{ className?: string }>;
  right?: React.ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <header
      className={cn(
        "cinema-header cinema-grain relative flex min-h-28 items-end overflow-hidden",
        className,
      )}
    >
      {/* Decorative photoreal backdrop (never indexed, never blocks input). */}
      <img
        src={image}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading="eager"
        className={cn(
          "cinema-header__img pointer-events-none select-none",
          reducedMotion && "[transform:none]",
        )}
      />
      <div className="cinema-header__veil" aria-hidden="true" />

      <div className="flex w-full flex-wrap items-end justify-between gap-3 p-5 sm:p-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" /> : null}
            <span className="truncate">{title}</span>
          </h1>
          {subtitle ? (
            <p className="mt-1 max-w-xl text-sm leading-snug text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
    </header>
  );
}
