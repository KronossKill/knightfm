"use client";
// Knight FM — shared market display atoms (Task 4-c).
// PositionBadge, Stars, PlayerCardView, useCountdown, ClubPickList.

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/index";
import type { PlayerCardData } from "./types";

// ─── Position badge (premium dark palette, no blue/indigo) ────────

const POSITION_STYLES: Record<string, string> = {
  GK: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  DF: "bg-primary/15 text-primary border-primary/30",
  MF: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  FW: "bg-destructive/15 text-destructive border-destructive/30",
};

export function PositionBadge({ position, className }: { position: string; className?: string }) {
  const { t } = useI18n();
  const label = t(`pos.${position}`);
  return (
    <Badge
      variant="outline"
      className={cn("font-semibold tracking-wide", POSITION_STYLES[position] ?? "bg-muted text-muted-foreground", className)}
    >
      {label.startsWith("pos.") ? position : label}
    </Badge>
  );
}

// ─── Stars ────────────────────────────────────────────────────────

export function Stars({ value, className }: { value: number; className?: string }) {
  const { t } = useI18n();
  const clamped = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("markets.player.starsAria", { stars: clamped })}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", i < clamped ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

// ─── Player card (shared across direct / auctions / free agents) ──

export function PlayerCardView({ player, className }: { player: PlayerCardData; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-bold text-foreground"
        aria-hidden="true"
      >
        {player.ovr}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{player.name}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <PositionBadge position={player.position} />
          <span className="text-xs text-muted-foreground">{player.age}</span>
          <Stars value={player.stars} />
        </div>
      </div>
    </div>
  );
}

// ─── Countdown (auctions) ─────────────────────────────────────────

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function useCountdown(expiresAt: string | null): { label: string; expired: boolean } {
  const target = expiresAt ? new Date(expiresAt).getTime() : 0;
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);
  const remaining = target - now;
  return { label: formatRemaining(remaining), expired: remaining <= 0 };
}

// ─── Club pick (acting club selector for multi-club owners) ───────

export interface ClubPickOption {
  id: string;
  name: string;
  operatingFund?: number;
}

export function ClubPickList({
  clubs,
  value,
  onChange,
  labelId,
}: {
  clubs: ClubPickOption[];
  value: string | null;
  onChange: (id: string) => void;
  labelId?: string;
}) {
  const { formatCurrency } = useI18n();
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid max-h-44 gap-2 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2"
    >
      {clubs.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "flex min-h-11 flex-col items-start justify-center rounded-md border px-3 py-2 text-left transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === c.id
              ? "border-primary/60 bg-primary/10"
              : "border-border bg-card hover:bg-muted/60"
          )}
        >
          <span className="w-full truncate text-sm font-medium">{c.name}</span>
          {typeof c.operatingFund === "number" && (
            <span className="text-xs text-muted-foreground">{formatCurrency(c.operatingFund)}</span>
          )}
        </button>
      ))}
    </div>
  );
}
