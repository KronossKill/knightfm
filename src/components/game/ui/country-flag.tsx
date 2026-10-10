"use client";
// Knight FM — CountryFlag (Task 67, USER MANDATE): renders an ISO 3166-1
// alpha-2 code as an SVG flag via the flag-icons package (works on every
// platform — Windows cannot render flag emoji, so we never rely on it).
// Invalid codes render nothing (defensive: data comes from geo resolution).

import { cn } from "@/lib/utils";

export function CountryFlag({
  code,
  count,
  className,
}: {
  /** ISO 3166-1 alpha-2, e.g. "ES". */
  code: string;
  /** Optional connection count shown next to the flag. */
  count?: number;
  className?: string;
}) {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  const iso = code.toUpperCase();
  return (
    <span
      className={cn("inline-flex items-center gap-0.5 align-middle", className)}
      title={count !== undefined ? `${iso} · ${count}` : iso}
    >
      <span
        className={cn(`fi fi-${iso.toLowerCase()}`, "inline-block h-3 w-4 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/15")}
        aria-hidden="true"
      />
      {count !== undefined && (
        <span className="text-[10px] font-semibold leading-none tabular-nums text-muted-foreground">
          {count}
        </span>
      )}
    </span>
  );
}
