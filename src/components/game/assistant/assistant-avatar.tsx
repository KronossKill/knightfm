"use client";
// Knight FM — modern AI badge for the Knight Assistant (Task 108, USER MANDATE:
// "cambia el icono de la IA, algo más moderno y profesional").
// Rounded gradient tile + four-point spark glyph + optional soft pulse ring.
// Replaces the old generic `Bot` icon everywhere the assistant appears
// (floating button, chat header, bubbles, typing indicator, dashboard, landing).

import { cn } from "@/lib/utils";

const TILE = {
  sm: "size-6 rounded-[8px]",
  md: "size-10 rounded-xl",
  lg: "size-14 rounded-2xl",
} as const;

const GLYPH = {
  sm: "size-3.5",
  md: "size-5",
  lg: "size-7",
} as const;

export function AssistantAvatar({
  size = "md",
  glow = false,
  className,
}: {
  size?: keyof typeof TILE;
  glow?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-primary via-primary/85 to-emerald-600 text-primary-foreground shadow-md shadow-primary/25",
        TILE[size],
        className
      )}
    >
      {glow && (
        <span className="absolute inset-0 animate-ping rounded-[inherit] ring-2 ring-primary/50 [animation-duration:2.4s]" />
      )}
      <svg viewBox="0 0 24 24" fill="currentColor" className={GLYPH[size]}>
        {/* Four-point AI spark with concave curves + secondary star */}
        <path d="M12 2c.55 5.2 4.8 9.45 10 10-5.2.55-9.45 4.8-10 10-.55-5.2-4.8-9.45-10-10 5.2-.55 9.45-4.8 10-10Z" />
        <path d="M19 2.6c.22 1.82 1.68 3.28 3.5 3.5-1.82.22-3.28 1.68-3.5 3.5-.22-1.82-1.68-3.28-3.5-3.5 1.82-.22 3.28-1.68 3.5-3.5Z" opacity=".85" />
      </svg>
      <span className="sr-only">AI</span>
    </span>
  );
}
