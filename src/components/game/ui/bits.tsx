"use client";
// Knight FM — shared presentational bits for game views (Task 4-a).
// Premium dark, emerald accents, gold for premium touches. WCAG AA:
// every icon-only element carries aria-labels, trends are icon + text + tooltip.

import * as React from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Star, AlertTriangle, Inbox } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Brand, Trend } from "@/components/game/api";

/** Brand shape served by most endpoints (badgeShape / crestPattern optional → safe fallbacks). */
export type BrandLike = Pick<Brand, "initials" | "primaryColor" | "secondaryColor"> & {
  crestPattern?: string;
  badgeShape?: string;
} | null;

// ── Time helpers (client-only to avoid hydration drift) ─────────

/** Ticking `Date.now()` — returns 0 before hydration so SSR and client agree. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Task 27-f: whole days remaining until an ISO timestamp (≥ 1 while it still
 *  applies) — feeds the "Injured ({d} d)" badge. Caller guarantees a future
 *  (or just-expired) timestamp; a stale one degrades to 1. */
export function daysUntil(iso: string, nowMs: number): number {
  const diff = new Date(iso).getTime() - nowMs;
  return Math.max(1, Math.ceil(diff / 86_400_000));
}

export function formatUtcClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "00:00:00";
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${p(h)}:${p(m)}:${p(sec)}` : `${p(h)}:${p(m)}:${p(sec)}`;
}

// ── Club crest (SVG shield/circle/square + 7 crest patterns) ────

export type CrestShape = "shield" | "circle" | "square";
export type CrestPattern = "solid" | "stripes-v" | "stripes-h" | "halves" | "quarters" | "sash" | "checker";

const CREST_SHAPES: CrestShape[] = ["shield", "circle", "square"];
const CREST_PATTERNS: CrestPattern[] = [
  "solid", "stripes-v", "stripes-h", "halves", "quarters", "sash", "checker",
];

export function normalizeCrestShape(value: string | undefined): CrestShape {
  return CREST_SHAPES.includes(value as CrestShape) ? (value as CrestShape) : "shield";
}

export function normalizeCrestPattern(value: string | undefined): CrestPattern {
  return CREST_PATTERNS.includes(value as CrestPattern) ? (value as CrestPattern) : "solid";
}

/** WCAG-style relative luminance (0 dark → 1 light) for a #RRGGBB color. */
function hexLuminance(hex: string): number {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Classic shield path inside the 0 0 40 40 viewBox. */
const SHIELD_PATH = "M20 2 L35 7 V19 C35 28 28.5 34.5 20 38 C11.5 34.5 5 28 5 19 V7 Z";

/**
 * ClubCrest (Task 24-a) — the club's visual identity: a clipped SVG badge
 * (shield | circle | square) painted with the brand's two colors using one of
 * seven heraldic patterns, with the initials centered (text color chosen by
 * luminance, stroked with the opposite color for contrast on any pattern).
 */
export function ClubCrest({
  primary,
  secondary,
  shape,
  pattern,
  initials,
  size = "md",
  className,
}: {
  primary: string;
  secondary: string;
  shape?: string;
  pattern?: string;
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipId = `crest-clip-${uid}`;
  const sh = normalizeCrestShape(shape);
  const pat = normalizeCrestPattern(pattern);
  const dims = size === "sm" ? "size-6" : size === "lg" ? "size-11" : "size-8";
  const fontSize = size === "sm" ? 11 : size === "lg" ? 15 : 13;
  const textColor = hexLuminance(primary) > 0.6 ? "#0b1220" : "#ffffff";

  const patternLayer = (() => {
    switch (pat) {
      case "stripes-v":
        return (
          <g fill={secondary}>
            <rect x="8" y="0" width="5" height="40" />
            <rect x="17.5" y="0" width="5" height="40" />
            <rect x="27" y="0" width="5" height="40" />
          </g>
        );
      case "stripes-h":
        return (
          <g fill={secondary}>
            <rect x="0" y="8" width="40" height="5" />
            <rect x="0" y="17.5" width="40" height="5" />
            <rect x="0" y="27" width="40" height="5" />
          </g>
        );
      case "halves":
        return <rect x="20" y="0" width="20" height="40" fill={secondary} />;
      case "quarters":
        return (
          <g fill={secondary}>
            <rect x="20" y="0" width="20" height="20" />
            <rect x="0" y="20" width="20" height="20" />
          </g>
        );
      case "sash":
        return (
          <path d="M-6 36 L36 -6 L46 4 L4 46 Z" fill={secondary} />
        );
      case "checker":
        return (
          <g fill={secondary}>
            <rect x="10" y="0" width="10" height="10" />
            <rect x="30" y="0" width="10" height="10" />
            <rect x="0" y="10" width="10" height="10" />
            <rect x="20" y="10" width="10" height="10" />
            <rect x="10" y="20" width="10" height="10" />
            <rect x="30" y="20" width="10" height="10" />
            <rect x="0" y="30" width="10" height="10" />
            <rect x="20" y="30" width="10" height="10" />
          </g>
        );
      default:
        return null;
    }
  })();

  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 leading-none", dims, className)}
    >
      <svg viewBox="0 0 40 40" width="100%" height="100%" role="presentation" focusable="false">
        <defs>
          <clipPath id={clipId}>
            {sh === "circle" ? (
              <circle cx="20" cy="20" r="18" />
            ) : sh === "square" ? (
              <rect x="2" y="2" width="36" height="36" rx="6" />
            ) : (
              <path d={SHIELD_PATH} />
            )}
          </clipPath>
        </defs>
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y="0" width="40" height="40" fill={primary} />
          {patternLayer}
        </g>
        {/* Shape outline in the secondary color keeps the crest crisp on any background */}
        {sh === "circle" ? (
          <circle cx="20" cy="20" r="17.5" fill="none" stroke={secondary} strokeWidth="2.5" />
        ) : sh === "square" ? (
          <rect x="3" y="3" width="34" height="34" rx="5.5" fill="none" stroke={secondary} strokeWidth="2.5" />
        ) : (
          <path d={SHIELD_PATH} fill="none" stroke={secondary} strokeWidth="2.5" />
        )}
        <text
          x="20"
          y="21"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight="700"
          fill={textColor}
          stroke={secondary}
          strokeWidth="1.6"
          paintOrder="stroke"
          style={{ letterSpacing: "0.5px", userSelect: "none" }}
        >
          {initials}
        </text>
      </svg>
    </span>
  );
}

// ── Brand badge (club identity) ─────────────────────────────────

export function BrandBadge({
  brand,
  name,
  size = "md",
  className,
}: {
  brand: BrandLike;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const initials = brand?.initials || name.slice(0, 2).toUpperCase();
  const primary = brand?.primaryColor || "#10b981";
  const secondary = brand?.secondaryColor || "#0b1220";
  return (
    <ClubCrest
      primary={primary}
      secondary={secondary}
      shape={brand?.badgeShape}
      pattern={brand?.crestPattern}
      initials={initials}
      size={size}
      className={className}
    />
  );
}

// ── Position badge ──────────────────────────────────────────────

const POS_STYLES: Record<string, string> = {
  GK: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DF: "bg-primary/15 text-primary border-primary/30",
  MF: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  FW: "bg-destructive/15 text-destructive border-destructive/30",
};

export function PositionBadge({ pos, label, className }: { pos: string; label?: string; className?: string }) {
  const { t } = useI18n();
  return (
    <Badge
      variant="outline"
      className={cn("min-w-9 justify-center px-1.5 font-mono text-[11px]", POS_STYLES[pos] ?? "bg-muted text-muted-foreground", className)}
      aria-label={t(`pos.${pos}`)}
    >
      {label ?? t(`pos.${pos}`)}
    </Badge>
  );
}

/** Maps a detailed position (CB, LB, DM, LW, ST…) to its color group (GK/DF/MF/FW). */
export function posGroupOf(detailedPos: string): "GK" | "DF" | "MF" | "FW" {
  if (detailedPos === "GK") return "GK";
  if (["CB", "LB", "RB"].includes(detailedPos)) return "DF";
  if (["DM", "CM", "AM", "LM", "RM"].includes(detailedPos)) return "MF";
  return "FW";
}

// ── Stars (potential tier) ──────────────────────────────────────

export function Stars({ n, className }: { n: number; className?: string }) {
  const { t } = useI18n();
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("player.stars", { n })}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden="true"
          className={cn(
            "size-3.5",
            i <= n ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/40"
          )}
        />
      ))}
    </span>
  );
}

// ── Stat bar with tooltip ───────────────────────────────────────

function toneOf(value: number, invert = false): string {
  const v = invert ? 100 - value : value;
  if (v >= 70) return "bg-primary";
  if (v >= 40) return "bg-amber-500";
  return "bg-destructive";
}

export function StatBar({
  label,
  value,
  invert = false,
  className,
}: {
  label: string;
  value: number;
  /** Invert tone thresholds (e.g. fatigue: high = bad). */
  invert?: boolean;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-1.5", className)}>
            <span className="w-16 shrink-0 truncate text-[11px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn("h-full rounded-full transition-all", toneOf(value, invert))}
                style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
              />
            </div>
            <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {value}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <span className="font-mono">
            {label}: {value}/100
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Attribute trend arrow ───────────────────────────────────────

export function TrendArrow({ trend, className }: { trend: Trend | undefined; className?: string }) {
  const { t } = useI18n();
  if (!trend || trend === "flat") {
    return (
      <span className={cn("inline-flex items-center", className)} aria-label={t("player.trend.flat")}>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex rounded-sm">
                <Minus aria-hidden="true" className="size-3.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("player.trend.flat")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    );
  }
  const up = trend === "up";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center", className)} aria-label={t(up ? "player.trend.up" : "player.trend.down")}>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="inline-flex rounded-sm">
              <Icon
                aria-hidden="true"
                className={cn("size-3.5", up ? "text-primary" : "text-destructive")}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t(up ? "player.trend.up" : "player.trend.down")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}

// ── Segmented bar (facility levels 1-10) ────────────────────────

export function SegmentedBar({ level, max = 10, className }: { level: number; max?: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)} role="img" aria-label={`${level}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "h-2 flex-1 rounded-sm transition-colors",
            i < level ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

// ── States: empty / error / skeletons ───────────────────────────

export function EmptyState({
  title,
  hint,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center",
        className
      )}
      role="status"
    >
      <Icon aria-hidden="true" className="size-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground/90">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 py-10 text-center",
        className
      )}
      role="alert"
    >
      <AlertTriangle aria-hidden="true" className="size-8 text-destructive" />
      <p className="max-w-md text-sm text-foreground/90">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="min-h-11">
        {t("common.retry")}
      </Button>
    </div>
  );
}

export function CardsSkeleton({ n = 3, className }: { n?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-8 w-2/3" />
          <Skeleton className="mt-4 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-3">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={cn("h-8", c === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Key/value cell ──────────────────────────────────────────────

export function KV({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}
