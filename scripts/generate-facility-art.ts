/**
 * Knight FM — Ultra-HD facility art generator (Task: instalaciones 10 niveles).
 *
 * Generates 60 resolution-independent SVG illustrations (6 facility types × 10
 * levels) into public/facilities/. SVG = vector, so the art NEVER loses quality
 * when resized (ultra HD by construction: infinite resolution).
 *
 * Each level is visually distinct: structures grow, tiers/lights/wings/props
 * are added progressively. Level 1 = humble; Level 10 = world-class with gold
 * trim. Deterministic output (seeded PRNG) so re-runs are byte-stable.
 *
 * Run: bun scripts/generate-facility-art.ts
 * Naming: public/facilities/<slug>-l<1..10>.svg
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1200;
const H = 800;
const OUT_DIR = join(import.meta.dir, "..", "public", "facilities");

/* ─────────────────────────── tiny SVG helpers ─────────────────────────── */

const n = (v: number) => Math.round(v * 100) / 100;
const el = (tag: string, attrs: Record<string, string | number>) => {
  const a = Object.entries(attrs)
    .map(([k, v]) => `${k}="${typeof v === "number" ? n(v) : v}"`)
    .join(" ");
  return `<${tag} ${a}/>`;
};
const rect = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  el("rect", { x, y, width: w, height: h, fill, ...parseExtra(extra) });
const rrect = (x: number, y: number, w: number, h: number, r: number, fill: string, extra = "") =>
  el("rect", { x, y, width: w, height: h, rx: r, fill, ...parseExtra(extra) });
const circle = (cx: number, cy: number, r: number, fill: string, extra = "") =>
  el("circle", { cx, cy, r, fill, ...parseExtra(extra) });
const ellipse = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = "") =>
  el("ellipse", { cx, cy, rx, ry, fill, ...parseExtra(extra) });
const poly = (pts: number[][], fill: string, extra = "") =>
  el("polygon", { points: pts.map((p) => `${n(p[0])},${n(p[1])}`).join(" "), fill, ...parseExtra(extra) });
const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = "") =>
  el("line", { x1, y1, x2, y2, stroke, "stroke-width": w, ...parseExtra(extra) });
const path = (d: string, fill: string, extra = "") =>
  el("path", { d, fill, ...parseExtra(extra) });
const group = (inner: string, extra = "") =>
  `<g${extra ? " " + extra : ""}>${inner}</g>`;
const parseExtra = (s: string): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const m of s.matchAll(/([\w-]+)=("([^"]*)"|'([^']*)')/g)) out[m[1]] = m[3] ?? m[4];
  return out;
};
const lin = (a: number, b: number, t: number) => a + (b - a) * t;

/** deterministic PRNG (mulberry32) */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lg = (id: string, stops: [number, string, number?][], x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
  stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("") +
  "</linearGradient>";
const rg = (id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.7) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">` +
  stops.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ""}/>`).join("") +
  "</radialGradient>";

/* ───────────────────────── shared scene pieces ───────────────────────── */

const GOLD = "#e8c15a";
const GOLD_HI = "#f6de9a";
const WARM = "#ffd98a";

/** soft ground shadow under a structure */
const shadow = (cx: number, cy: number, rx: number, ry = 14, op = 0.28) =>
  ellipse(cx, cy, rx, ry, "#000", `opacity="${op}"`);

/** window grid; lit windows get warm fill + optional glow dot */
function windows(opts: {
  x: number; y: number; w: number; h: number; cols: number; rows: number;
  litRatio: number; fill?: string; lit?: string; dark?: string; glow?: boolean; seed?: number;
}): string {
  const { x, y, w, h, cols, rows, litRatio, glow = true, seed = 1 } = opts;
  const fill = opts.fill ?? "#1c2c38";
  const lit = opts.lit ?? WARM;
  const dark = opts.dark ?? "#0d161d";
  const rand = prng(seed);
  const gw = w / cols, gh = h / rows;
  let out = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isLit = rand() < litRatio;
      const wx = x + c * gw + gw * 0.18, wy = y + r * gh + gh * 0.2;
      const ww = gw * 0.64, wh = gh * 0.6;
      out += rrect(wx, wy, ww, wh, 1.5, isLit ? lit : dark, isLit && glow ? 'opacity="0.95"' : "");
      if (isLit && glow) out += circle(wx + ww / 2, wy + wh / 2, ww * 0.75, lit, 'opacity="0.14"');
    }
  }
  return group(out);
}

/** stadium floodlight pylon with optional light cone */
function floodlight(x: number, topY: number, baseY: number, on: boolean, cone: boolean, conePts: number[][]) {
  let s = "";
  s += rect(x - 3, topY, 6, baseY - topY, "#3a4650");
  s += rect(x - 12, baseY - 6, 24, 8, "#2c363f");
  // head
  s += rrect(x - 20, topY - 22, 40, 22, 4, "#45525d");
  const lamps = on ? 4 : 0;
  for (let i = 0; i < 4; i++) {
    const lx = x - 13 + i * 8.5;
    s += circle(lx, topY - 11, 3, on ? "#fffbe8" : "#5a6a76");
    if (on) s += circle(lx, topY - 11, 7, "#fff3c4", 'opacity="0.35"');
  }
  if (cone && on) s += poly(conePts, "url(#coneGrad)", 'opacity="0.5"');
  return group(s);
}

/** pennant flag on a pole */
function pennant(x: number, y: number, h: number, color: string, seed: number) {
  const dir = seed % 2 === 0 ? 1 : -1;
  let s = "";
  s += rect(x - 1.5, y - h, 3, h, "#8a949c");
  s += poly([[x + 1, y - h], [x + 1 + 22 * dir, y - h + 6], [x + 1, y - h + 13]], color);
  return group(s);
}

/** simple stylized tree */
function tree(x: number, y: number, s: number, dark = "#14311f", light = "#1e4a2d") {
  let out = "";
  out += rect(x - 2.5 * s, y - 14 * s, 5 * s, 16 * s, "#3d2c1e");
  out += circle(x, y - 22 * s, 11 * s, dark);
  out += circle(x - 7 * s, y - 16 * s, 8 * s, light);
  out += circle(x + 7 * s, y - 17 * s, 8.5 * s, dark);
  out += circle(x, y - 28 * s, 7.5 * s, light);
  return group(out);
}

/** mowing stripes on grass ground */
function grassStripes(y: number, h: number, toneA: string, toneB: string) {
  let out = rect(0, y, W, h, toneA);
  for (let x = -80; x < W; x += 160) out += poly([[x, y], [x + 80, y], [x + 110, y + h], [x + 30, y + h]], toneB, 'opacity="0.55"');
  return out;
}

function wrap(defs: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs>${defs}</defs>${body}</svg>`
  );
}

/* ═══════════════════════════ STADIUM ═══════════════════════════ */

function stadium(L: number): string {
  const p = (L - 1) / 9;
  const tiers = 1 + Math.floor(p * 3);          // 1..4 stand tiers
  const roof = L >= 5;
  const pylons = L >= 6 ? 4 : 2;
  const flags = Math.min(L, 8);
  const board = L >= 3;
  const gold = L === 10;
  const crowdRows = 2 + tiers * 2;
  const night = L >= 8;

  const defs =
    lg("sky", [[0, night ? "#07131f" : "#0c2231"], [0.7, night ? "#0c2233" : "#14424d"], [1, night ? "#123a35" : "#1b5b4b"]]) +
    rg("glowC", [[0, "#fff3c4", 0.5], [1, "#fff3c4", 0]]) +
    lg("coneGrad", [[0, "#fff3c4", 0.16], [1, "#fff3c4", 0]]) +
    lg("bowl", [[0, "#39434d"], [1, "#232c34"]]) +
    lg("pitch", [[0, "#2c7a4b"], [1, "#1f5e38"]]) +
    lg("roofG", [[0, "#e8edf1"], [1, "#b8c3cc"]]);

  let b = "";
  // sky + stars
  b += rect(0, 0, W, H, "url(#sky)");
  if (night) {
    const rand = prng(L * 31 + 7);
    for (let i = 0; i < 26; i++) b += circle(rand() * W, rand() * 240, rand() * 1.4 + 0.5, "#cfe3ee", 'opacity="0.7"');
    b += circle(1040, 110, 34, "#e6edf2", 'opacity="0.9"') + circle(1054, 100, 30, "url(#sky)", 'opacity="0.92"');
  }
  // far hills
  b += path(`M0 ${520} Q 200 ${456} 420 ${506} T 900 ${498} T ${W} ${512} L ${W} ${H} L 0 ${H} Z`, "#0e2a22", 'opacity="0.9"');

  // ── stadium bowl ──
  const cx = W / 2;
  const bowlW = lin(760, 1050, p);
  const bowlH = lin(190, 300, p);
  const bowlY = lin(360, 300, p);
  const bowlX = cx - bowlW / 2;
  const groundY = 700;
  b += shadow(cx, groundY - 6, bowlW * 0.55, 26, 0.35);

  // outer shell
  b += rrect(bowlX, bowlY, bowlW, bowlH, 70, "url(#bowl)");
  b += rrect(bowlX + 8, bowlY + 8, bowlW - 16, bowlH - 16, 64, "#2b353f");
  // tiers (inner rings) — each tier adds a lighter ring + crowd
  for (let t = 0; t < tiers; t++) {
    const inset = 18 + t * ((Math.min(bowlW, 260) - 40) / tiers);
    const tw = bowlW - inset * 2, th = bowlH - inset * 1.6;
    b += rrect(bowlX + inset, bowlY + inset * 0.8, tw, th, Math.max(40, 60 - t * 6), t % 2 ? "#39434e" : "#424d59");
    // crowd dots
    const rand = prng(L * 101 + t * 13 + 5);
    const rows = Math.max(1, Math.floor(crowdRows / tiers));
    let dots = "";
    for (let r = 0; r < rows; r++) {
      const ry = bowlY + inset * 0.8 + 10 + r * ((th - 20) / rows);
      const count = Math.floor((tw - 30) / 9);
      for (let i = 0; i < count; i++) {
        const col = ["#d8dee4", "#c2cad2", "#e8c15a", "#9fb0bd", "#d8dee4"][Math.floor(rand() * 5)];
        dots += circle(bowlX + inset + 18 + i * 9 + rand() * 3, ry + rand() * 4, 1.8, col, 'opacity="0.85"');
      }
    }
    b += group(dots);
  }
  // inner opening (pitch seen from angle)
  const pitchW = bowlW * 0.52, pitchH = bowlH * 0.5;
  b += rrect(cx - pitchW / 2, bowlY + bowlH - pitchH - 14, pitchW, pitchH, 26, "url(#pitch)");
  b += rrect(cx - pitchW / 2 + 10, bowlY + bowlH - pitchH - 6, pitchW - 20, 5, 2.5, "#cfe3d8", 'opacity="0.7"');

  // gold elite trim
  if (gold) {
    b += rrect(bowlX - 4, bowlY - 8, bowlW + 8, 10, 5, "url(#goldG)");
    b += circle(cx, bowlY - 14, 16, "url(#goldG)");
    b += circle(cx, bowlY - 14, 26, GOLD, 'opacity="0.25"');
  }

  // roof canopy
  if (roof) {
    const rw = bowlW + 40;
    b += path(
      `M ${cx - rw / 2} ${bowlY + 6} Q ${cx} ${bowlY - lin(28, 64, p)} ${cx + rw / 2} ${bowlY + 6} ` +
      `L ${cx + rw / 2 - 30} ${bowlY + 16} Q ${cx} ${bowlY - lin(10, 34, p)} ${cx - rw / 2 + 30} ${bowlY + 16} Z`,
      "url(#roofG)",
    );
    if (night || L >= 8) {
      for (let i = 0; i <= 8; i++) {
        const lx = cx - rw / 2 + 40 + (i * (rw - 80)) / 8;
        b += circle(lx, bowlY - lin(12, 30, p) + 10, 3.2, WARM, 'opacity="0.9"') + circle(lx, bowlY - lin(12, 30, p) + 10, 8, "#fff3c4", 'opacity="0.2"');
      }
    }
  }

  // flags on top
  for (let i = 0; i < flags; i++) {
    const fx = lin(bowlX + 60, bowlX + bowlW - 60, flags === 1 ? 0.5 : i / (flags - 1));
    const col = gold && i % 3 === 1 ? GOLD : ["#3fae63", "#d8dee4", "#3fae63"][i % 3];
    b += pennant(fx, bowlY + (roof ? -lin(14, 44, p) : 2), 26, col, i);
  }

  // scoreboard
  if (board) {
    const sx = bowlX + bowlW - 30;
    const sy = bowlY + 24;
    b += rrect(sx - 4, sy - 4, 74, 40, 6, "#11181d");
    b += rrect(sx, sy, 66, 32, 4, "#0b3b2a");
    const rand = prng(L * 977);
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++)
        if (rand() > 0.35) b += rect(sx + 5 + c * 9.5, sy + 5 + r * 9, 6, 5, "#5fdba0", 'opacity="0.9"');
    b += rect(sx + 10, sy + 32, 46, 6, "#1c262d");
  }

  // floodlights
  const py = bowlY - 10;
  const coneBase = [cx - pitchW / 2, bowlY + bowlH];
  for (let i = 0; i < pylons; i++) {
    const left = i % 2 === 0;
    const px = left ? lin(bowlX - 40, cx - bowlW * 0.42, i / Math.max(1, pylons - 1)) : lin(bowlX + bowlW * 1.42, bowlX + bowlW + 40, (i - 1) / Math.max(1, pylons - 1));
    const topY = py - lin(60, 130, p);
    const conePts: number[][] = [
      [px - 8, topY - 8],
      [px + 8, topY - 8],
      left ? [coneBase[0] - 40, coneBase[1]] : [coneBase[0] + pitchW + 40, coneBase[1]],
      left ? [coneBase[0] + pitchW * 0.4, coneBase[1]] : [coneBase[0] + pitchW * 0.6, coneBase[1]],
    ];
    b += floodlight(px, topY, py + 6, night || L >= 6, true, conePts);
  }

  // foreground pitch strip
  b += grassStripes(640, H - 640, "#1d5c37", "#1a5230");
  b += ellipse(cx, 660, 180, 46, "#236a40", 'opacity="0.5"');
  b += ellipse(cx, 660, 120, 30, "#2b7a4b", 'opacity="0.55"');

  return wrap(defs, b);
}

/* ═══════════════════════════ TRAINING CENTER ═══════════════════════════ */

function trainingCenter(L: number): string {
  const p = (L - 1) / 9;
  const floors = 1 + Math.floor(p * 2);   // 1..3 floors
  const pitches = 1 + Math.floor(p * 2);  // 1..3 pitches
  const ballWall = L >= 4;
  const banner = L >= 3;
  const gym = L >= 6;
  const roofUnits = L >= 4;
  const antenna = L >= 6;
  const solar = L === 10;
  const pitchLights = L >= 8;
  const gold = L === 10;

  const defs =
    lg("sky", [[0, "#25150d"], [0.65, "#4a2a16"], [1, "#7a4a22"]]) +
    lg("pitchT", [[0, "#2f7a49"], [1, "#1f5c36"]]) +
    lg("facade", [[0, "#3c4753"], [1, "#2a333d"]]) +
    lg("facade2", [[0, "#46525f"], [1, "#313c47"]]) +
    rg("sunG", [[0, "#ffcf8a", 0.9], [1, "#ffcf8a", 0]]) +
    lg("goldG", [[0, GOLD_HI], [1, GOLD]]);

  let b = rect(0, 0, W, H, "url(#sky)");
  b += circle(950, 200, 120, "url(#sunG)");
  b += circle(950, 200, 46, "#ffd9a0", 'opacity="0.9"');
  // hills
  b += path(`M0 560 Q 260 500 520 545 T ${W} 540 L ${W} ${H} L 0 ${H} Z`, "#1c3a26", 'opacity="0.95"');

  const groundY = 640;
  const bw = lin(330, 470, p);
  const bh = lin(150, 320, p);
  const bx = 240 - bw / 2 + 60;
  const by = groundY - bh;
  b += shadow(bx + bw / 2, groundY, bw * 0.62, 20);

  // gym extension (behind, right)
  if (gym) {
    const gw2 = 170, gh2 = lin(90, 150, p);
    b += rrect(bx + bw - 20, groundY - gh2, gw2, gh2, 8, "url(#facade2)");
    b += windows({ x: bx + bw + 2, y: groundY - gh2 + 16, w: gw2 - 30, h: gh2 - 34, cols: 3, rows: 2, litRatio: 0.7, seed: L * 3 + 1 });
  }

  // main building
  b += rrect(bx, by, bw, bh, 10, "url(#facade)");
  b += rect(bx, by, bw, 10, "#1d252d");
  // floor bands + windows
  for (let f = 0; f < floors; f++) {
    const fy = by + 18 + f * ((bh - 30) / floors);
    b += rect(bx + 8, fy + (bh - 30) / floors - 4, bw - 16, 2.5, "#202a33", 'opacity="0.8"');
    b += windows({ x: bx + 16, y: fy, w: bw - 32, h: (bh - 30) / floors - 12, cols: gold ? 6 : 5, rows: 1, litRatio: lin(0.4, 0.9, p), seed: L * 17 + f });
  }
  // entrance
  b += rrect(bx + bw / 2 - 34, groundY - 54, 68, 54, 6, "#1a222a");
  b += rect(bx + bw / 2 - 26, groundY - 46, 22, 46, WARM, 'opacity="0.85"');
  b += rect(bx + bw / 2 + 4, groundY - 46, 22, 46, WARM, 'opacity="0.85"');
  b += rrect(bx + bw / 2 - 44, groundY - 60, 88, 8, 4, gold ? "url(#goldG)" : "#4a5763");
  // roof props
  if (roofUnits) for (let i = 0; i < 2 + Math.floor(p * 2); i++) b += rrect(bx + 30 + i * 54, by - 16, 36, 16, 3, "#39434d");
  if (antenna) {
    b += rect(bx + bw - 60, by - 64, 4, 64, "#39434d");
    b += circle(bx + bw - 58, by - 68, 5, "#ff8a7a", 'opacity="0.9"') + circle(bx + bw - 58, by - 68, 10, "#ff8a7a", 'opacity="0.25"');
  }
  if (solar) {
    b += poly([[bx + 60, by - 8], [bx + 130, by - 30], [bx + 200, by - 8]], "#1d2f3c");
    b += poly([[bx + 66, by - 10], [bx + 130, by - 28], [bx + 194, by - 10]], "#2c4f68");
    for (let i = 0; i < 4; i++) b += line(bx + 78 + i * 28, by - 12 - i * 4, bx + 96 + i * 28, by - 12 - i * 4, "#7fc7e8", 2, 'opacity="0.8"');
  }

  // banner on fence
  if (banner) {
    const fy2 = groundY - 26;
    b += rect(40, fy2 - 22, 180, 26, 3, "#244862");
    b += rect(44, fy2 - 18, 172, 18, 2, "#2e5b7d");
    for (let i = 0; i < 7; i++) b += rect(54 + i * 22, fy2 - 12, 12, 5, "#9fd4ef", 'opacity="0.8"');
  }
  // ball wall
  if (ballWall) {
    b += rrect(60, groundY - 90, 120, 90, 6, "#3a4149");
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) b += circle(80 + c * 22, groundY - 72 + r * 20, 5, "#525b64", 'opacity="0.8"');
    b += circle(96, groundY - 72, 7, "#d8dee4") + circle(140, groundY - 52, 7, "#e8c15a");
  }

  // training pitches (foreground)
  const pitchY = 660;
  for (let i = 0; i < pitches; i++) {
    const px = 90 + i * 360;
    const pw = 260, ph = 86;
    const rand = prng(L * 13 + i * 7);
    b += rrect(px, pitchY, pw, ph, 8, "url(#pitchT)");
    b += rect(px + pw / 2 - 1, pitchY + 8, 2, ph - 16, "#cfe3d8", 'opacity="0.7"');
    b += rrect(px + 12, pitchY + ph / 2 - 12, 20, 24, 3, "none", 'stroke="#cfe3d8" stroke-width="2"');
    b += rrect(px + pw - 32, pitchY + ph / 2 - 12, 20, 24, 3, "none", 'stroke="#cfe3d8" stroke-width="2"');
    for (let c = 0; c < 4 + Math.floor(p * 3); c++) {
      const conX = px + 40 + c * 44 + rand() * 10, conY = pitchY + 24 + rand() * 40;
      b += poly([[conX, conY], [conX + 6, conY + 10], [conX - 6, conY + 10]], "#ff9d4d");
    }
    if (pitchLights) {
      b += rect(px + 8, pitchY - 60, 4, 60, "#39434d");
      b += circle(px + 10, pitchY - 62, 4, "#fff3c4") + circle(px + 10, pitchY - 62, 9, "#fff3c4", 'opacity="0.3"');
    }
  }

  return wrap(defs, b);
}

/* ═══════════════════════════ YOUTH ACADEMY ═══════════════════════════ */

function youthAcademy(L: number): string {
  const p = (L - 1) / 9;
  const wings = 1 + Math.floor(p * 2);  // 1..3 building sections
  const trees = 2 + Math.floor(p * 4);
  const swings = L >= 2;
  const clock = L >= 9;
  const crest = L >= 5;
  const birds = L >= 7;
  const miniPitch = L >= 3;
  const garden = L >= 4;
  const gold = L === 10;

  const defs =
    lg("sky", [[0, "#0f2d3a"], [0.6, "#1c5a52"], [1, "#2f7d54"]]) +
    lg("lawn", [[0, "#2f7d4b"], [1, "#1e5c37"]]) +
    lg("house", [[0, "#5d4a38"], [1, "#43362a"]]) +
    lg("roofR", [[0, "#8a4433"], [1, "#5f2d22"]]) +
    lg("goldG", [[0, GOLD_HI], [1, GOLD]]);

  let b = rect(0, 0, W, H, "url(#sky)");
  // birds
  if (birds) {
    const rand = prng(L * 41);
    for (let i = 0; i < 4; i++) {
      const bx2 = 140 + rand() * 700, by2 = 90 + rand() * 110, s = 6 + rand() * 6;
      b += path(`M ${bx2} ${by2} q ${s} ${-s} ${s * 2} 0 q ${s} ${-s} ${s * 2} 0`, "none", `stroke="#dfe9ec" stroke-width="2.4" fill="none" opacity="0.85"`);
    }
  }
  // sun glow
  b += circle(210, 160, 110, "#ffe9b0", 'opacity="0.16"');

  const groundY = 620;
  b += rect(0, groundY, W, H - groundY, "url(#lawn)");

  // main academy: sections side by side
  const secW = lin(210, 260, p);
  const totalW = secW * wings + (wings - 1) * 14;
  const bx = (W - totalW) / 2;
  const bh = lin(180, 300, p);
  const by = groundY - bh + 20;
  b += shadow(W / 2, groundY + 8, totalW * 0.6, 22);

  for (let s = 0; s < wings; s++) {
    const x = bx + s * (secW + 14);
    const isMid = wings === 3 ? s === 1 : true;
    const hh = isMid ? bh : bh * 0.82;
    const yy = groundY + 20 - hh;
    b += rrect(x, yy, secW, hh, 10, "url(#house)");
    // pitched roof
    b += poly([[x - 12, yy], [x + secW / 2, yy - (isMid ? 54 : 40)], [x + secW + 12, yy]], "url(#roofR)");
    // windows: 2 rows
    b += windows({ x: x + 18, y: yy + 22, w: secW - 36, h: hh * 0.42, cols: isMid ? 4 : 3, rows: 2, litRatio: 0.55, fill: "#2a2018", seed: L * 19 + s });
    // door on middle
    if (isMid) {
      b += rrect(x + secW / 2 - 24, groundY + 20 - 58, 48, 58, 6, "#2c2118");
      b += rect(x + secW / 2 - 16, groundY + 20 - 50, 32, 50, "#8a6a44", 'opacity="0.95"');
      if (gold) b += rrect(x + secW / 2 - 30, groundY + 20 - 64, 60, 7, 3, "url(#goldG)");
    }
    // clock tower on middle roof
    if (clock && isMid) {
      const tx = x + secW / 2;
      b += rect(tx - 16, yy - 54 - 56, 32, 56, "url(#house)");
      b += poly([[tx - 22, yy - 54 - 56], [tx, yy - 54 - 84], [tx + 22, yy - 54 - 56]], "url(#roofR)");
      b += circle(tx, yy - 54 - 34, 11, "#f4ead2");
      b += line(tx, yy - 54 - 34, tx, yy - 54 - 41, "#43362a", 2);
      b += line(tx, yy - 54 - 34, tx + 6, yy - 54 - 32, "#43362a", 2);
    }
  }

  // crest shield
  if (crest) {
    const cx = W / 2, cy = by + 74;
    b += path(`M ${cx - 26} ${cy - 26} h 52 v 30 q 0 26 -26 34 q -26 -8 -26 -34 Z`, gold ? "url(#goldG)" : "#c9a227");
    b += path(`M ${cx - 19} ${cy - 19} h 38 v 24 q 0 19 -19 26 q -19 -7 -19 -26 Z`, "#1d3a26");
    b += circle(cx, cy - 4, 7, "#eaf0eb", 'opacity="0.9"');
    b += poly([[cx - 11, cy + 6], [cx + 11, cy + 6], [cx, cy + 18]], "#eaf0eb", 'opacity="0.9"');
  }

  // trees
  const rand = prng(L * 53 + 3);
  for (let i = 0; i < trees; i++) {
    const tx = i % 2 === 0 ? 70 + rand() * 120 : W - 190 + rand() * 120;
    const s = 0.8 + rand() * 0.7;
    b += tree(tx, groundY + 40 + rand() * 90, s);
  }

  // flower garden strips
  if (garden) {
    b += rrect(150, groundY + 44, 900, 26, 13, "#245232");
    for (let i = 0; i < 18; i++) {
      const fx = 170 + i * 48;
      b += circle(fx, groundY + 57, 5, ["#e77", "#e8c15a", "#d97fb8", "#7fd4a8"][i % 4], 'opacity="0.95"');
    }
  }

  // mini pitch with goals
  if (miniPitch) {
    const px = 120, py = 700, pw = 300, ph = 74;
    b += rrect(px, py, pw, ph, 10, "#2f7d4b");
    b += rect(px + pw / 2 - 1, py + 8, 2, ph - 16, "#dfe9ec", 'opacity="0.75"');
    b += rrect(px + 10, py + ph / 2 - 11, 16, 22, 3, "none", 'stroke="#dfe9ec" stroke-width="2.5"');
    b += rrect(px + pw - 26, py + ph / 2 - 11, 16, 22, 3, "none", 'stroke="#dfe9ec" stroke-width="2.5"');
    b += circle(px + pw / 2, py + ph / 2, 8, "#f4f7f4");
  }
  // playground swings
  if (swings) {
    const sx = 830, sy = 700;
    b += line(sx, sy, sx, sy - 70, "#6b5136", 6);
    b += line(sx + 90, sy, sx + 90, sy - 70, "#6b5136", 6);
    b += line(sx - 6, sy - 70, sx + 96, sy - 70, "#6b5136", 7);
    b += line(sx + 22, sy - 68, sx + 20, sy - 18, "#cfd6da", 2.5);
    b += line(sx + 66, sy - 68, sx + 68, sy - 26, "#cfd6da", 2.5);
    b += rect(sx + 14, sy - 18, 14, 5, "#8a6a44");
    b += rect(sx + 62, sy - 26, 14, 5, "#8a6a44");
  }

  return wrap(defs, b);
}

/* ═══════════════════════════ MEDICAL CENTER ═══════════════════════════ */

function medicalCenter(L: number): string {
  const p = (L - 1) / 9;
  const floors = 1 + Math.floor(p * 3);   // 1..4
  const cross = L >= 3;
  const ambulance = L >= 5;
  const helipad = L >= 8;
  const hrLine = L >= 6;
  const canopy = L >= 2;
  const glass = L >= 4;
  const gold = L === 10;

  const defs =
    lg("sky", [[0, "#0a1c28"], [0.65, "#12454f"], [1, "#1a6a63"]]) +
    lg("med", [[0, "#e8eef0"], [1, "#c3ced4"]]) +
    lg("glassB", [[0, "#2e6470"], [1, "#173641"]]) +
    rg("crossG", [[0, "#7fe3b1", 0.85], [1, "#7fe3b1", 0]]) +
    lg("goldG", [[0, GOLD_HI], [1, GOLD]]);

  let b = rect(0, 0, W, H, "url(#sky)");
  const groundY = 650;
  b += rect(0, groundY, W, H - groundY, "#15313a");
  b += rect(0, groundY, W, 6, "#1d4350");

  const bw = lin(360, 520, p);
  const bh = lin(170, 400, p);
  const bx = (W - bw) / 2 + 40;
  const by = groundY - bh;
  b += shadow(bx + bw / 2, groundY + 4, bw * 0.6, 20);

  // rooftop helipad
  if (helipad) {
    b += ellipse(bx + bw - 90, by - 8, 66, 20, "#243b44");
    b += ellipse(bx + bw - 90, by - 12, 60, 17, "#2e4c57");
    b += ellipse(bx + bw - 90, by - 12, 34, 10, "none", 'stroke="#dfe9ec" stroke-width="3"');
    b += rect(bx + bw - 108, by - 19, 36, 6, "#dfe9ec") + rect(bx + bw - 96, by - 16, 6, 12, "#dfe9ec") + rect(bx + bw - 78, by - 16, 6, 12, "#dfe9ec");
  }

  // main block
  b += rrect(bx, by, bw, bh, 12, "url(#med)");
  // glass stripe column
  if (glass) {
    b += rrect(bx + 16, by + 16, 34, bh - 30, 6, "url(#glassB)");
    for (let i = 0; i < floors; i++) b += rect(bx + 20, by + 24 + i * ((bh - 34) / floors), 26, (bh - 34) / floors - 12, "#7fc7d8", 'opacity="0.35"');
  }
  // floor windows
  for (let f = 0; f < floors; f++) {
    const fy = by + 18 + f * ((bh - 30) / floors);
    const cols = 5;
    for (let c = 0; c < cols; c++) {
      const wx = bx + 62 + c * ((bw - 84) / cols);
      const ww = (bw - 84) / cols - 12;
      b += rrect(wx, fy, ww, (bh - 30) / floors - 14, 3, "#9fc4cf");
      b += rrect(wx + 3, fy + 3, ww - 6, (bh - 30) / floors - 20, 2, "#2e6470", 'opacity="0.85"');
      if ((f + c) % 3 === 0) b += rrect(wx + 3, fy + 3, ww - 6, (bh - 30) / floors - 20, 2, WARM, 'opacity="0.5"');
    }
  }
  // heart-rate line on facade
  if (hrLine) {
    const hy = by + bh - 34;
    b += rect(bx + 62, hy - 12, bw - 84, 26, 4, "#0f2d36", 'opacity="0.85"');
    const mid = bx + 62 + (bw - 84) / 2;
    b += path(`M ${bx + 70} ${hy} h 40 l 8 -10 l 8 20 l 8 -16 l 6 6 h 30 l 8 -10 l 8 20 l 8 -16 l 6 6 h 40`, "none", `stroke="#57e0a8" stroke-width="2.6" fill="none"`);
    b += circle(mid, hy, 3, "#57e0a8", 'opacity="0.8"');
  }

  // cross sign
  if (cross) {
    const cx = bx + bw + 70, cy = by + 60;
    b += rect(cx - 44, cy - 44, 88, 88, 10, "none");
    b += circle(cx, cy, 62, "url(#crossG)");
    b += rrect(cx - 15, cy - 44, 30, 88, 6, "#57e0a8");
    b += rrect(cx - 44, cy - 15, 88, 30, 6, "#57e0a8");
    if (gold) { b += rrect(cx - 50, cy + 52, 100, 8, 4, "url(#goldG)"); }
  }

  // entrance canopy
  if (canopy) {
    const ex = bx + bw / 2 - 70;
    b += rrect(bx + bw / 2 - 34, groundY - 56, 68, 56, 6, "#33424c");
    b += rect(bx + bw / 2 - 26, groundY - 48, 22, 48, "#9fc4cf", 'opacity="0.6"');
    b += rect(bx + bw / 2 + 4, groundY - 48, 22, 48, "#9fc4cf", 'opacity="0.6"');
    b += poly([[ex - 12, groundY - 62], [ex + 152, groundY - 62], [ex + 140, groundY - 78], [ex, groundY - 78]], "#dde6ea");
    b += rect(bx + bw / 2 - 58, groundY - 66, 116, 4, "#b8c8cf");
  }

  // ambulance
  if (ambulance) {
    const ax = 90, ay = groundY + 10;
    b += rrect(ax, ay - 58, 150, 44, 8, "#e8eef0");
    b += rrect(ax + 96, ay - 76, 54, 62, 8, "#e8eef0");
    b += rrect(ax + 104, ay - 68, 34, 26, 4, "#2e6470");
    b += rect(ax + 8, ay - 44, 26, 12, 3, "#e04f4a");
    b += rect(ax + 44, ay - 44, 12, 26, 3, "#e04f4a");
    b += circle(ax + 30, ay - 12, 14, "#1a262e") + circle(ax + 30, ay - 12, 6, "#4a5a66");
    b += circle(ax + 118, ay - 12, 14, "#1a262e") + circle(ax + 118, ay - 12, 6, "#4a5a66");
    b += rect(ax + 118, ay - 84, 3, 8, "#57e0a8") + rect(ax + 114, ay - 81, 11, 3, "#57e0a8");
    b += circle(ax + 119, ay - 78, 8, "#57e0a8", 'opacity="0.4"');
  }

  return wrap(defs, b);
}

/* ═══════════════════════════ SPORTS SCIENCE ═══════════════════════════ */

function sportsScience(L: number): string {
  const p = (L - 1) / 9;
  const dishes = 1 + Math.floor(p * 2);  // 1..3 radar dishes
  const dome = L >= 5;
  const tower = L >= 7;
  const holo = L >= 9;
  const screens = L >= 4;
  const wing = L >= 6;
  const gold = L === 10;

  const defs =
    lg("sky", [[0, "#0d0a24"], [0.6, "#221447"], [1, "#3c1f5e"]]) +
    lg("lab", [[0, "#3a4553"], [1, "#232b35"]]) +
    lg("lab2", [[0, "#465363"], [1, "#2a333f"]]) +
    rg("holoG", [[0, "#a1f2dc", 0.7], [1, "#a1f2dc", 0]]) +
    lg("goldG", [[0, GOLD_HI], [1, GOLD]]);

  let b = rect(0, 0, W, H, "url(#sky)");
  // stars + nebula
  const rand0 = prng(L * 77 + 1);
  for (let i = 0; i < 40; i++) b += circle(rand0() * W, rand0() * 320, rand0() * 1.3 + 0.4, "#cfd8ea", 'opacity="0.8"');
  b += ellipse(880, 150, 260, 90, "#6b4fa8", 'opacity="0.18"');
  b += ellipse(880, 150, 140, 46, "#a1f2dc", 'opacity="0.08"');

  const groundY = 640;
  b += rect(0, groundY, W, H - groundY, "#161a26");
  b += rect(0, groundY, W, 5, "#242c3c");

  const bw = lin(340, 480, p);
  const bh = lin(180, 340, p);
  const bx = (W - bw) / 2 - 60;
  const by = groundY - bh;
  b += shadow(bx + bw / 2, groundY + 2, bw * 0.62, 20);

  // cylinder wing (right)
  if (wing) {
    const wx = bx + bw - 10, ww = lin(90, 150, p), wh = lin(120, 220, p);
    b += rrect(wx, groundY - wh, ww, wh, ww / 2, "url(#lab2)");
    b += rrect(wx + 10, groundY - wh + 12, ww - 20, wh - 30, (ww - 20) / 2, "#1e2c38", 'opacity="0.9"');
    for (let i = 0; i < 3; i++) b += rect(wx + 16, groundY - wh + 30 + i * 34, ww - 32, 8, "#7de3c8", 'opacity="0.5"');
  }

  // main block
  b += rrect(bx, by, bw, bh, 12, "url(#lab)");
  b += rect(bx, by, bw, 8, "#1a222c");
  b += windows({ x: bx + 18, y: by + 22, w: bw - 36, h: bh - 96, cols: 5, rows: Math.max(2, floors(L)), litRatio: 0.55, fill: "#223241", lit: "#8ff0d8", seed: L * 23 });
  // data screens band
  if (screens) {
    const sy = by + bh - 62;
    b += rect(bx + 14, sy, bw - 28, 44, 4, "#101722");
    const rand = prng(L * 91);
    for (let c = 0; c < 8; c++) {
      const bh2 = 6 + rand() * 30;
      b += rect(bx + 22 + c * ((bw - 44) / 8), sy + 40 - bh2, (bw - 60) / 8, bh2, c % 3 === 0 ? "#e8c15a" : "#7de3c8", 'opacity="0.9"');
    }
  }

  // dome
  if (dome) {
    const dx = bx + bw + (wing ? 90 : 60), dr = lin(60, 110, p);
    const dy = groundY - 30;
    b += path(`M ${dx - dr} ${dy} A ${dr} ${dr} 0 0 1 ${dx + dr} ${dy} Z`, "url(#lab2)");
    b += path(`M ${dx - dr * 0.6} ${dy - dr * 0.36} A ${dr * 0.62} ${dr * 0.62} 0 0 1 ${dx + dr * 0.5} ${dy - dr * 0.44}`, "none", 'stroke="#7de3c8" stroke-width="2.5" opacity="0.7"');
    b += rect(dx - 2, dy - dr - 26, 4, 26, "#39434d");
    b += circle(dx, dy - dr - 30, 4, "#ff8a7a") + circle(dx, dy - dr - 30, 9, "#ff8a7a", 'opacity="0.3"');
    if (holo) {
      b += ellipse(dx, dy - dr * 0.7, dr * 0.95, dr * 0.34, "none", 'stroke="#a1f2dc" stroke-width="3" opacity="0.85"');
      b += ellipse(dx, dy - dr * 0.7, dr * 1.18, dr * 0.44, "url(#holoG)", 'opacity="0.5"');
      b += circle(dx, dy - dr * 0.7, 5, "#d9fff4");
    }
  }

  // radar dishes
  for (let i = 0; i < dishes; i++) {
    const dx = 130 + i * 90;
    const dy = groundY - lin(30, 60, p);
    const s = lin(0.8, 1.25, p);
    b += rect(dx - 3, dy - 40 * s, 6, 40 * s, "#39434d");
    b += path(`M ${dx - 26 * s} ${dy - 44 * s} A ${27 * s} ${27 * s} 0 0 1 ${dx + 26 * s} ${dy - 44 * s} L ${dx + 18 * s} ${dy - 30 * s} A ${17 * s} ${17 * s} 0 0 0 ${dx - 18 * s} ${dy - 30 * s} Z`, "#4a5763");
    b += line(dx, dy - 40 * s, dx, dy - 56 * s, "#7de3c8", 2.5, 'opacity="0.85"');
    b += circle(dx, dy - 58 * s, 3.5, "#a1f2dc") + circle(dx, dy - 58 * s, 8, "#a1f2dc", 'opacity="0.25"');
  }

  // antenna tower
  if (tower) {
    const tx = W - 120;
    const th = lin(160, 260, p);
    b += poly([[tx - 18, groundY], [tx - 4, groundY - th], [tx + 4, groundY - th], [tx + 18, groundY]], "none", 'stroke="#4a5763" stroke-width="5"');
    for (let i = 1; i <= 4; i++) {
      const yy = groundY - (th * i) / 5;
      const half = 18 * (1 - i / 5.5);
      b += line(tx - half, yy, tx + half, yy, "#4a5763", 3);
      b += circle(tx, yy, 2.6, "#a1f2dc", 'opacity="0.9"');
    }
    b += circle(tx, groundY - th - 4, 5, "#ff8a7a") + circle(tx, groundY - th - 4, 11, "#ff8a7a", 'opacity="0.28"');
    if (gold) b += circle(tx, groundY - th - 4, 16, "none", 'stroke="url(#goldG)" stroke-width="3"');
  }

  return wrap(defs, b);
}
const floors = (L: number) => 1 + Math.floor(((L - 1) / 9) * 2);

/* ═══════════════════════════ REST ROOMS ═══════════════════════════ */

function restRooms(L: number): string {
  const p = (L - 1) / 9;
  const litMin = 4, litMax = 24;
  const litCount = Math.round(lin(litMin, litMax, p));
  const fountain = L >= 6;
  const pool = L >= 8;
  const lights = L >= 9;
  const balcony = L >= 5;
  const gold = L === 10;

  const defs =
    lg("sky", [[0, "#0a1226"], [0.62, "#1b2a4a"], [1, "#33456b"]]) +
    rg("moonG", [[0, "#eef2f6", 0.9], [1, "#eef2f6", 0]]) +
    lg("lodge", [[0, "#4a3a2c"], [1, "#2f251c"]]) +
    lg("roofD", [[0, "#3d3128"], [1, "#241d16"]]) +
    lg("poolG", [[0, "#49c7d8"], [1, "#1e7f96"]]) +
    lg("goldG", [[0, GOLD_HI], [1, GOLD]]);

  let b = rect(0, 0, W, H, "url(#sky)");
  // stars
  const rand0 = prng(L * 61 + 2);
  for (let i = 0; i < 30; i++) b += circle(rand0() * W, rand0() * 260, rand0() * 1.2 + 0.4, "#dfe6f2", 'opacity="0.8"');
  // moon
  b += circle(1010, 130, 90, "url(#moonG)", 'opacity="0.5"');
  b += circle(1010, 130, 34, "#eef2f6");
  b += circle(1022, 120, 30, "url(#sky)", 'opacity="0.9"');

  const groundY = 630;
  b += rect(0, groundY, W, H - groundY, "#1c2a1c");
  b += rect(0, groundY, W, 5, "#27371f");

  const bw = lin(380, 540, p);
  const bh = lin(190, 330, p);
  const bx = (W - bw) / 2;
  const by = groundY - bh;
  b += shadow(W / 2, groundY + 6, bw * 0.6, 22);

  // main lodge
  b += rrect(bx, by, bw, bh, 10, "url(#lodge)");
  // pitched roof
  b += poly([[bx - 20, by], [W / 2, by - lin(50, 90, p)], [bx + bw + 20, by]], "url(#roofD)");
  // chimney + smoke
  b += rect(bx + bw - 90, by - lin(50, 90, p) + 6, 24, lin(40, 70, p), "#3a2f26");
  if (L >= 3) {
    const rand = prng(L * 7);
    for (let i = 0; i < 3; i++) {
      const sy = by - lin(50, 90, p) - 8 - i * 22, sx = bx + bw - 78 + rand() * 8 - 4;
      b += circle(sx + i * 6, sy, 7 + i * 3.4, "#c9d2dc", `opacity="${0.35 - i * 0.09}"`);
    }
  }

  // window grid (warm lights)
  const cols = 6, rows = Math.max(2, Math.round(lin(2, 4, p)));
  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = bx + 24 + c * ((bw - 48) / cols);
      const wy = by + 20 + r * ((bh - 34) / rows);
      const ww = (bw - 48) / cols - 14;
      const wh = (bh - 34) / rows - 14;
      const isLit = placed < litCount && (r + c) % 2 === 0;
      if (isLit) placed++;
      b += rrect(wx, wy, ww, wh, 3, isLit ? WARM : "#1d2530");
      if (isLit) b += circle(wx + ww / 2, wy + wh / 2, ww * 0.7, WARM, 'opacity="0.12"');
      b += rect(wx, wy + wh / 2 - 1, ww, 2, "#241d16", 'opacity="0.8"');
    }
  }

  // balconies
  if (balcony) {
    for (let r = 1; r < rows; r++) {
      const wy = by + 20 + r * ((bh - 34) / rows);
      b += rect(bx + bw * 0.3, wy - 6, bw * 0.4, 5, "#5a4632");
      for (let i = 0; i < 8; i++) b += rect(bx + bw * 0.3 + 6 + i * ((bw * 0.4 - 12) / 7), wy - 1, 3, 10, "#5a4632", 'opacity="0.9"');
    }
  }

  // porch + door
  b += rrect(W / 2 - 30, groundY - 58, 60, 58, 6, "#241c14");
  b += rect(W / 2 - 22, groundY - 50, 20, 50, "#8a6a44");
  b += rect(W / 2 + 2, groundY - 50, 20, 50, "#8a6a44");
  b += poly([[W / 2 - 44, groundY - 60], [W / 2 + 44, groundY - 60], [W / 2 + 52, groundY - 76], [W / 2 - 52, groundY - 76]], gold ? "url(#goldG)" : "#3d3128");

  // string lights
  if (lights) {
    for (let i = 0; i <= 10; i++) {
      const lx = 90 + i * ((W - 180) / 10);
      const ly = 560 + Math.sin((i / 10) * Math.PI) * -24;
      b += circle(lx, ly, 3, "#ffe3a1", 'opacity="0.95"') + circle(lx, ly, 8, "#ffe3a1", 'opacity="0.18"');
      if (i < 10) b += line(lx, ly, 90 + (i + 1) * ((W - 180) / 10), 560 + Math.sin(((i + 1) / 10) * Math.PI) * -24, "#8a7a5a", 1.2, 'opacity="0.6"');
    }
  }

  // fountain
  if (fountain) {
    const fx = 200, fy = groundY + 90;
    b += ellipse(fx, fy, 74, 20, "#22342c");
    b += ellipse(fx, fy, 62, 16, "#2c4a3c");
    b += ellipse(fx, fy - 2, 52, 12, "url(#poolG)", 'opacity="0.9"');
    b += rect(fx - 5, fy - 42, 10, 42, "#5a6a72");
    b += circle(fx, fy - 50, 7, "#bfeef4", 'opacity="0.9"');
    b += path(`M ${fx - 3} ${fy - 46} q -12 18 -20 40`, "none", 'stroke="#bfeef4" stroke-width="2.5" opacity="0.7"');
    b += path(`M ${fx + 3} ${fy - 46} q 12 18 20 40`, "none", 'stroke="#bfeef4" stroke-width="2.5" opacity="0.7"');
  }

  // pool
  if (pool) {
    const px = 760, py = groundY + 60;
    b += rrect(px, py, 300, 90, 20, "#22342c");
    b += rrect(px + 8, py + 8, 284, 74, 16, "url(#poolG)");
    for (let i = 0; i < 5; i++) b += path(`M ${px + 30 + i * 52} ${py + 20} q 10 8 0 16 q -10 8 0 16`, "none", 'stroke="#bfeef4" stroke-width="2" opacity="0.5"');
    b += circle(px + 40, py + 45, 10, "#eaf4f6", 'opacity="0.9"');
  }

  // garden trees
  const rand = prng(L * 29 + 5);
  const nT = 2 + Math.floor(p * 3);
  for (let i = 0; i < nT; i++) {
    const tx = i % 2 === 0 ? 60 + rand() * 80 : W - 140 + rand() * 80;
    b += tree(tx, groundY + 30 + rand() * 50, 0.7 + rand() * 0.5, "#16301f", "#1d4028");
  }

  return wrap(defs, b);
}

/* ─────────────────────────── emit ─────────────────────────── */

const SCENES: Record<string, (L: number) => string> = {
  stadium,
  "training-center": trainingCenter,
  "youth-academy": youthAcademy,
  "medical-center": medicalCenter,
  "sports-science": sportsScience,
  "rest-rooms": restRooms,
};

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
let totalBytes = 0;
for (const [slug, fn] of Object.entries(SCENES)) {
  for (let L = 1; L <= 10; L++) {
    const svgStr = fn(L);
    const file = join(OUT_DIR, `${slug}-l${L}.svg`);
    writeFileSync(file, svgStr, "utf8");
    count++;
    totalBytes += Buffer.byteLength(svgStr);
  }
}
console.log(`OK — ${count} SVGs written to ${OUT_DIR} (avg ${Math.round(totalBytes / count / 1024)} KB)`);
