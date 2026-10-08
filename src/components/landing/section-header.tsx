"use client";
// Knight FM — shared landing section header: gold overline + h2 + lead paragraph.

import { useI18n } from "@/lib/i18n";
import { Reveal } from "./reveal";

interface SectionHeaderProps {
  kickerKey: string;
  titleKey: string;
  subtitleKey?: string;
  /** DOM id for the h2 (used by SectionTracker aria-labelledby). */
  headingId: string;
}

export function SectionHeader({ kickerKey, titleKey, subtitleKey, headingId }: SectionHeaderProps) {
  const { t } = useI18n();
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] gold-accent">{t(kickerKey)}</p>
      <h2 id={headingId} className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {t(titleKey)}
      </h2>
      {subtitleKey ? (
        <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">{t(subtitleKey)}</p>
      ) : null}
    </Reveal>
  );
}
