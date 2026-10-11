// Knight FM — WCAG 2.1 AA contrast verifier (Master UI/UX v2.0).
// Reads the canonical theme tokens (src/lib/theme-tokens.ts, generated from
// globals.css), converts oklch() → sRGB, and checks every critical color pair
// per theme. Text pairs must reach 4.5:1; UI/graphic pairs 3:1.
//
// Run:  bun scripts/verify-wcag-contrast.mjs
// Exit: 0 = all PASS · 1 = at least one FAIL (CI gate).
// Writes docs/ui/themes/wcag-contrast.md (machine-generated report).

import { THEME_TOKENS } from "../src/lib/theme-tokens.ts";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── oklch → sRGB ─────────────────────────────────────────────────

function parseOklch(str) {
  const m = /oklch\(\s*([\d.]+)\s*([\d.]+)?\s*([\d.]+)?\s*\)/.exec(str);
  if (!m) return null;
  return { l: parseFloat(m[1]), c: m[2] ? parseFloat(m[2]) : 0, h: m[3] ? parseFloat(m[3]) : 0 };
}

function oklchToLinearSrgb({ l, c, h }) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3;
  return [
    +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

function toSrgbHex(oklchStr) {
  const ok = parseOklch(oklchStr);
  if (!ok) return null;
  const lin = oklchToLinearSrgb(ok);
  const clamped = lin.map((v) => Math.min(1, Math.max(0, v)));
  const outOfGamut = lin.some((v) => v < -0.0005 || v > 1.0005);
  const srgb = clamped.map(gamma);
  const hex =
    "#" +
    srgb
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return { hex, outOfGamut };
}

function relLuminance(oklchStr) {
  const ok = parseOklch(oklchStr);
  if (!ok) return null;
  const lin = oklchToLinearSrgb(ok).map((v) => Math.min(1, Math.max(0, v)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fg, bg) {
  const L1 = relLuminance(fg);
  const L2 = relLuminance(bg);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const fmt = (r) => r.toFixed(2) + ":1";

// ── Pairs under audit ─────────────────────────────────────────────
// kind: TEXT (≥4.5) · UI (≥3, non-text) · INFO (reported, mitigated)

const PAIRS = [
  { token: "foreground", on: "background", kind: "TEXT", use: "Cuerpo de texto base" },
  { token: "foreground", on: "card", kind: "TEXT", use: "Texto sobre tarjetas" },
  { token: "card-foreground", on: "card", kind: "TEXT", use: "Texto de tarjeta" },
  { token: "foreground", on: "popover", kind: "TEXT", use: "Texto en menús/popovers" },
  { token: "muted-foreground", on: "background", kind: "TEXT", use: "Texto secundario (base)" },
  { token: "muted-foreground", on: "card", kind: "TEXT", use: "Texto secundario (tarjeta)" },
  { token: "secondary-foreground", on: "secondary", kind: "TEXT", use: "Texto botón secundario" },
  { token: "accent-foreground", on: "accent", kind: "TEXT", use: "Texto sobre hover/accent" },
  { token: "sidebar-foreground", on: "sidebar", kind: "TEXT", use: "Texto sidebar" },
  { token: "primary-foreground", on: "primary", kind: "TEXT", use: "Texto botón primario" },
  { token: "WHITE", on: "danger", kind: "TEXT", use: "Texto botón peligro (blanco)" },
  { token: "primary", on: "background", kind: "UI", use: "Botón primario vs fondo" },
  { token: "danger", on: "card", kind: "UI", use: "Botón peligro vs tarjeta" },
  { token: "ring", on: "background", kind: "UI", use: "Anillo de foco vs fondo" },
  { token: "ring", on: "card", kind: "UI", use: "Anillo de foco vs tarjeta" },
  { token: "destructive", on: "card", kind: "TEXT", use: "Rojo de texto (alertas, importes negativos) vs tarjeta" },
  { token: "input", on: "card", kind: "INFO", use: "Borde de input (mitigado: fondo + etiqueta + foco)" },
  { token: "chart-1", on: "card", kind: "UI", use: "Gráfico 1 vs tarjeta" },
  { token: "chart-2", on: "card", kind: "UI", use: "Gráfico 2 vs tarjeta" },
  { token: "chart-3", on: "card", kind: "UI", use: "Gráfico 3 vs tarjeta" },
  { token: "chart-4", on: "card", kind: "UI", use: "Gráfico 4 vs tarjeta" },
  { token: "chart-5", on: "card", kind: "UI", use: "Gráfico 5 vs tarjeta" },
];

const WHITE = "oklch(1 0 0)";
const THRESHOLD = { TEXT: 4.5, UI: 3.0, INFO: 0 };

// ── Run ───────────────────────────────────────────────────────────

let failures = 0;
const themeReports = [];

for (const [id, th] of Object.entries(THEME_TOKENS)) {
  const rows = [];
  for (const p of PAIRS) {
    const fg = p.token === "WHITE" ? WHITE : th.tokens[p.token];
    const bg = th.tokens[p.on];
    if (!fg || !bg) {
      rows.push({ ...p, ratio: null, status: "FAIL", note: "token ausente" });
      failures++;
      continue;
    }
    const ratio = contrast(fg, bg);
    const min = THRESHOLD[p.kind];
    const status = ratio >= min ? "PASS" : p.kind === "INFO" ? "INFO" : "FAIL";
    if (status === "FAIL") failures++;
    const hexFg = p.token === "WHITE" ? "#FFFFFF" : toSrgbHex(fg)?.hex;
    const hexBg = toSrgbHex(bg)?.hex;
    rows.push({ ...p, ratio, status, hexFg, hexBg });
  }
  themeReports.push({ id, label: th.label, mode: th.mode, rows });
}

// ── Console ───────────────────────────────────────────────────────

for (const tr of themeReports) {
  console.log(`\n■ ${tr.label} (${tr.id}, ${tr.mode})`);
  for (const r of tr.rows) {
    const icon = r.status === "PASS" ? "✔" : r.status === "INFO" ? "·" : "✘";
    console.log(
      `  ${icon} ${r.status.padEnd(4)} ${fmt(r.ratio ?? 0).padStart(7)}  [${r.kind}]  ${r.token} / ${r.on} — ${r.use}`,
    );
  }
}
console.log(
  failures === 0
    ? `\nWCAG AA: ALL PASS (0 failures across ${themeReports.length} themes, ${PAIRS.length} pairs each)\n`
    : `\nWCAG AA: ${failures} FAILURES — fix tokens before shipping\n`,
);

// ── Markdown report ───────────────────────────────────────────────

const md = [
  "<!-- MACHINE-GENERATED by scripts/verify-wcag-contrast.mjs — do not hand-edit. -->",
  "# Knight FM — Informe de contraste WCAG 2.1 AA (5 temas)",
  "",
  "Umbral texto: **4.5:1** · Umbral UI/gráficos: **3:1** · INFO = par mitigado por otro mecanismo (etiqueta, fondo o anillo de foco).",
  "",
];
for (const tr of themeReports) {
  md.push(`## ${tr.label} — \`${tr.id}\` (${tr.mode === "dark" ? "oscuro" : "claro"})`, "");
  md.push("| Par (frente / fondo) | Uso | Tipo | Ratio | sRGB frente | sRGB fondo | Estado |");
  md.push("|---|---|---|---|---|---|---|");
  for (const r of tr.rows) {
    md.push(
      `| \`${r.token}\` / \`${r.on}\` | ${r.use} | ${r.kind} | **${r.ratio?.toFixed(2)}:1** | \`${r.hexFg}\` | \`${r.hexBg}\` | ${r.status} |`,
    );
  }
  md.push("");
}
const outDir = join(ROOT, "docs", "ui", "themes");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "wcag-contrast.md"), md.join("\n") + "\n");
console.log("Report written → docs/ui/themes/wcag-contrast.md");

process.exit(failures === 0 ? 0 : 1);
