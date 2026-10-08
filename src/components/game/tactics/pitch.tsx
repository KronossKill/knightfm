"use client";
// Knight FM — interactive tactical pitch (Task 4-b, spec §12).
// Vertical SVG pitch (own goal at BOTTOM — goalkeeper lowest, strikers highest;
// layout x = 0 own goal → 100 opponent, displayed flipped) with fixed pitch
// greens (theme-independent) and HTML slot tiles positioned by
// FORMATION_LAYOUTS. Tiles are real <button>s: focusable, Enter opens the slot
// dialog, aria-labelled, ≥44px touch targets. Tiles are square/rounded — never
// circular.

import { useId } from "react";
import { Bandage, Ban, Plus } from "lucide-react";
import { FormationSlot, FORMATION_LAYOUTS, Formation, Position } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { fitPct, isPlayerAvailable, shortName, SquadPlayer } from "./use-tactics";

export type PitchMode = "combined" | "in" | "out";

interface PitchProps {
  formation: Formation;
  slots: Record<string, string | null>;
  squadById: Map<string, SquadPlayer>;
  mode: PitchMode;
  animatePosition: boolean;
  onSlotClick: (slot: FormationSlot) => void;
}

// Fixed pitch surface — a pitch is green in every theme (WCAG AA is guaranteed
// by dark tile backgrounds with light text, never by theme tokens here).
const STRIPE_A = "#0c3521";
const STRIPE_B = "#0d3b25";
const LINE = "rgba(255,255,255,0.42)";

const EMERALD = "#34d399";
const AMBER = "#f59e0b";
const RED = "#f87171";

function fitColor(fit: number): string {
  if (fit >= 80) return EMERALD;
  if (fit >= 50) return AMBER;
  return RED;
}

function fatigueColor(fatigue: number): string {
  if (fatigue <= 40) return EMERALD;
  if (fatigue <= 70) return AMBER;
  return RED;
}

export function Pitch({ formation, slots, squadById, mode, animatePosition, onSlotClick }: PitchProps) {
  const { t } = useI18n();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const layout = FORMATION_LAYOUTS[formation];

  // Possession-mode remapping of display positions (x stays 0..100):
  // in-possession stretches toward the opponent goal; out-of-possession
  // compresses the outfield block toward our own goal (compact defensive shape).
  const displayX = (slot: FormationSlot): number => {
    if (mode === "in") return slot.pos === "GK" ? slot.x : Math.min(95, slot.x + 9);
    if (mode === "out") return slot.pos === "GK" ? slot.x : 8 + (slot.x - 8) * 0.62;
    return slot.x;
  };

  const lineX = (pos: Position): number | null => {
    const xs = layout.filter((s) => s.pos === pos).map(displayX);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };

  // 0..100 grid → SVG coords (viewBox 68×105, own goal at BOTTOM):
  // x=0 (own goal line) maps to the bottom edge, x=100 to the top edge.
  const px = (lat: number) => (lat / 100) * 68;
  const py = (x100: number) => 105 - (x100 / 100) * 105;

  const defX = lineX("DF");
  const midX = lineX("MF");
  const fwX = lineX("FW");
  const channels = [22, 50, 78];

  const blockDepth =
    mode === "out"
      ? Math.min(72, Math.max(...layout.filter((s) => s.pos !== "GK").map(displayX)) + 7)
      : 0;

  return (
    <div
      role="group"
      aria-label={t("tactics.pitch.aria")}
      className="relative mx-auto aspect-[68/105] w-full max-w-[540px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-black/50"
    >
      {/* ── Surface ─────────────────────────────────────────────── */}
      <svg
        viewBox="0 0 68 105"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {Array.from({ length: 10 }).map((_, i) => (
          <rect
            key={i}
            x="0"
            y={i * 10.5}
            width="68"
            height="10.5"
            fill={i % 2 === 0 ? STRIPE_A : STRIPE_B}
          />
        ))}
        <g stroke={LINE} strokeWidth="0.3" fill="none">
          {/* Boundary, halfway line, centre circle */}
          <rect x="2" y="2" width="64" height="101" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          {/* Opponent box (top) */}
          <rect x="13.84" y="2" width="40.32" height="16.5" />
          <rect x="24.84" y="2" width="18.32" height="5.5" />
          <path d="M 26.69 18.5 A 9.15 9.15 0 0 0 41.31 18.5" />
          {/* Own box (bottom) — goalkeeper side */}
          <rect x="13.84" y="86.5" width="40.32" height="16.5" />
          <rect x="24.84" y="97" width="18.32" height="5.5" />
          <path d="M 26.69 86.5 A 9.15 9.15 0 0 1 41.31 86.5" />
          {/* Corner arcs */}
          <path d="M 2 3.2 A 1.2 1.2 0 0 0 3.2 2" />
          <path d="M 64.8 2 A 1.2 1.2 0 0 0 66 3.2" />
          <path d="M 66 101.8 A 1.2 1.2 0 0 0 64.8 103" />
          <path d="M 3.2 103 A 1.2 1.2 0 0 0 2 101.8" />
        </g>
        {/* Spots + goal mouths */}
        <g fill={LINE}>
          <circle cx="34" cy="52.5" r="0.45" />
          <circle cx="34" cy="13" r="0.4" />
          <circle cx="34" cy="92" r="0.4" />
        </g>
        <g stroke={LINE} strokeWidth="0.45" fill="none">
          <rect x="30.34" y="0.8" width="7.32" height="1.2" />
          <rect x="30.34" y="103" width="7.32" height="1.2" />
        </g>
      </svg>

      {/* ── Possession overlays ─────────────────────────────────── */}
      <svg
        viewBox="0 0 68 105"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={`${uid}-arrow`}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EMERALD} />
          </marker>
        </defs>

        {mode === "in" && (
          <g stroke={EMERALD} strokeOpacity="0.55" strokeWidth="0.45" strokeDasharray="2.4 1.8" fill="none" vectorEffect="non-scaling-stroke">
            {defX !== null && midX !== null
              ? channels.map((c) => (
                  <line
                    key={`dm-${c}`}
                    x1={px(c)}
                    y1={py(defX)}
                    x2={px(c)}
                    y2={py(midX)}
                    markerEnd={`url(#${uid}-arrow)`}
                  />
                ))
              : null}
            {midX !== null && fwX !== null
              ? channels.map((c) => (
                  <line
                    key={`mf-${c}`}
                    x1={px(c)}
                    y1={py(midX)}
                    x2={px(c)}
                    y2={py(fwX)}
                    markerEnd={`url(#${uid}-arrow)`}
                  />
                ))
              : null}
          </g>
        )}

        {mode === "out" && (
          <g>
            <rect
              x="2"
              y={105 - py(blockDepth)}
              width="64"
              height={Math.max(10, py(blockDepth) - 2)}
              fill="#022c22"
              fillOpacity="0.4"
              stroke={EMERALD}
              strokeOpacity="0.4"
              strokeWidth="0.35"
              strokeDasharray="2 1.6"
            />
            {midX !== null
              ? [30, 70].map((c) => (
                  <line
                    key={`drop-${c}`}
                    x1={px(c)}
                    y1={py(midX) - 9}
                    x2={px(c)}
                    y2={py(midX) - 2}
                    stroke={EMERALD}
                    strokeOpacity="0.55"
                    strokeWidth="0.45"
                    strokeDasharray="2 1.8"
                    markerEnd={`url(#${uid}-arrow)`}
                  />
                ))
              : null}
          </g>
        )}
      </svg>

      {/* ── Slot tiles (HTML buttons — keyboard accessible) ─────── */}
      {layout.map((slot, idx) => {
        const pid = slots[slot.id] ?? null;
        const player = pid ? squadById.get(pid) ?? null : null;
        const x = displayX(slot);
        const jersey = idx + 1;
        const pos = { left: `${slot.y}%`, top: `${100 - x}%` };

        if (!player) {
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSlotClick(slot)}
              aria-label={t("tactics.slot.vacant", { label: slot.label })}
              className={cn(
                "absolute aspect-square w-[17%] min-w-[56px] max-w-[78px] -translate-x-1/2 -translate-y-1/2 rounded-lg outline-none",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c3521]",
                animatePosition && "transition-[left,top] duration-300 ease-out"
              )}
              style={pos}
            >
              <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-primary/40 bg-[#0b1220]/75 text-primary/85 shadow-lg">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-[9px] font-semibold uppercase tracking-wider">{slot.label}</span>
              </span>
            </button>
          );
        }

        const fit = fitPct(player, slot.pos);
        const unavailable = !isPlayerAvailable(player);
        const fColor = fitColor(fit);
        const formArrow = player.form >= 60 ? "▲" : player.form <= 40 ? "▼" : "●";
        const formLabel =
          player.form >= 60
            ? t("tactics.form.up")
            : player.form <= 40
              ? t("tactics.form.down")
              : t("tactics.form.flat");
        const formClass =
          player.form >= 60 ? "text-primary" : player.form <= 40 ? "text-red-300" : "text-white/50";
        const fName = shortName(player);

        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSlotClick(slot)}
            aria-label={t("tactics.slot.occupied", { label: slot.label, name: `${player.firstName} ${player.lastName}`.trim() })}
            className={cn(
              "absolute aspect-square w-[17%] min-w-[56px] max-w-[78px] -translate-x-1/2 -translate-y-1/2 rounded-lg outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c3521]",
              animatePosition && "transition-[left,top] duration-300 ease-out"
            )}
            style={pos}
          >
            {/* Suitability edge (positionFit: ≥80 green · 50-79 amber · <50 red) */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-1.5 bottom-1.5 z-10 w-[3px] rounded-full"
              style={{ backgroundColor: fColor }}
            />
            <span
              className={cn(
                "relative flex h-full w-full flex-col items-center justify-center gap-[3px] rounded-lg border bg-[#0b1220]/95 p-1 text-white shadow-lg",
                unavailable && "opacity-60 grayscale"
              )}
              style={{ borderColor: `${fColor}aa` }}
            >
              {unavailable && (
                <span className="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full border border-red-300/70 bg-[#450a0a] text-red-200">
                  {player.suspension > 0 ? (
                    <Ban className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Bandage className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>
              )}
              <span className="flex w-full items-center justify-between px-0.5 leading-none">
                <span className={cn("text-[11px] font-bold tabular-nums", slot.pos === "GK" ? "text-amber-300" : "text-white")}>
                  {jersey}
                </span>
                <span className="text-[10px] font-semibold text-primary tabular-nums">{player.ovr}</span>
              </span>
              <span className="max-w-full truncate px-0.5 text-[9px] font-semibold uppercase tracking-wide leading-none">
                {fName}
              </span>
              <span className="flex items-center gap-0.5 leading-none">
                <span className="text-[8px] font-medium uppercase tracking-wider text-white/60">{slot.label}</span>
                <span role="img" aria-label={formLabel} className={cn("text-[7px]", formClass)}>
                  {formArrow}
                </span>
              </span>
              {/* Fatigue strip (3px, bottom) */}
              <span aria-hidden="true" className="absolute inset-x-1.5 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/15">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${player.fatigue}%`, backgroundColor: fatigueColor(player.fatigue) }}
                />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
