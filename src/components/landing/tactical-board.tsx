"use client";
// Knight FM — faithful CSS/SVG mockup of the Knight Tactical Board (spec §46.7):
// SVG pitch + square rounded-rectangle player tiles (number + short name), 4-3-3.
// Pure CSS/SVG, no external images, no circular tiles.

import { useI18n } from "@/lib/i18n";

interface Tile {
  x: number;
  y: number;
  n: number;
  name: string;
  gk?: boolean;
}

// 4-3-3 attacking upwards (opponent goal at top).
const TILES: Tile[] = [
  { x: 160, y: 438, n: 1, name: "DOR", gk: true },
  { x: 48, y: 352, n: 12, name: "RIO" },
  { x: 124, y: 366, n: 4, name: "KAN" },
  { x: 196, y: 366, n: 5, name: "SIL" },
  { x: 272, y: 352, n: 2, name: "WEB" },
  { x: 72, y: 258, n: 6, name: "NEB" },
  { x: 160, y: 244, n: 8, name: "ORT" },
  { x: 248, y: 258, n: 10, name: "LUC" },
  { x: 58, y: 124, n: 7, name: "VIN" },
  { x: 160, y: 104, n: 9, name: "ADA" },
  { x: 262, y: 124, n: 11, name: "EZE" },
];

// Dashed pass lanes between midfield triangle and striker.
const LANES: Array<[number, number, number, number]> = [
  [72, 258, 160, 244],
  [160, 244, 248, 258],
  [160, 244, 160, 104],
];

const STRIPE_H = 53.33;

export function TacticalBoard() {
  const { t } = useI18n();

  return (
    <svg
      viewBox="0 0 320 480"
      role="img"
      aria-label={t("landing.hero.board.title")}
      className="h-auto w-full rounded-xl"
      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
    >
      <title>{t("landing.hero.board.title")}</title>

      {/* Pitch base + mowing stripes */}
      <rect x="0" y="0" width="320" height="480" fill="#0c3521" rx="12" />
      {Array.from({ length: 9 }).map((_, i) => (
        <rect
          key={i}
          x="0"
          y={i * STRIPE_H}
          width="320"
          height={STRIPE_H}
          fill={i % 2 === 0 ? "#0d3b25" : "#0c3521"}
          opacity="0.9"
        />
      ))}

      {/* Markings */}
      <g stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.5" fill="none">
        <rect x="14" y="14" width="292" height="452" />
        <line x1="14" y1="240" x2="306" y2="240" />
        <circle cx="160" cy="240" r="42" />
        {/* Top (opponent) box */}
        <rect x="86" y="14" width="148" height="62" />
        <rect x="124" y="14" width="72" height="26" />
        <path d="M 126 76 A 42 42 0 0 0 194 76" />
        {/* Bottom (own) box */}
        <rect x="86" y="404" width="148" height="62" />
        <rect x="124" y="440" width="72" height="26" />
        <path d="M 126 404 A 42 42 0 0 1 194 404" />
        {/* Corner arcs */}
        <path d="M 14 22 A 8 8 0 0 0 22 14" />
        <path d="M 298 14 A 8 8 0 0 0 306 22" />
        <path d="M 306 458 A 8 8 0 0 0 298 466" />
        <path d="M 22 466 A 8 8 0 0 0 14 458" />
      </g>
      <circle cx="160" cy="240" r="2.5" fill="#ffffff" fillOpacity="0.8" />
      <circle cx="160" cy="58" r="2.5" fill="#ffffff" fillOpacity="0.8" />
      <circle cx="160" cy="422" r="2.5" fill="#ffffff" fillOpacity="0.8" />

      {/* Pass lanes */}
      <g stroke="#34d399" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="4 4">
        {LANES.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      {/* Player tiles — square rounded rectangles (never circular) */}
      {TILES.map((p) => (
        <g key={p.n} transform={`translate(${p.x} ${p.y})`}>
          <rect
            x="-28"
            y="-17"
            width="56"
            height="34"
            rx="8"
            fill="#0b1220"
            fillOpacity="0.92"
            stroke={p.gk ? "#d4af37" : "#10b981"}
            strokeOpacity={p.gk ? 0.95 : 0.85}
            strokeWidth="1.4"
          />
          <text
            textAnchor="middle"
            y="-2.5"
            fontSize="11.5"
            fontWeight="700"
            fill="#ecfdf5"
          >
            {p.n}
          </text>
          <text
            textAnchor="middle"
            y="10.5"
            fontSize="8"
            letterSpacing="1.6"
            fill={p.gk ? "#e7c96a" : "#a7f3d0"}
            fillOpacity="0.85"
          >
            {p.name}
          </text>
        </g>
      ))}
    </svg>
  );
}
