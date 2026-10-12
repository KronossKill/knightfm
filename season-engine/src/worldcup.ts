// Knight FM — season engine: MUNDIAL DE CLUBES (formato UCL, 40 equipos).
// Bombos (10 equipos cada uno, UN club por región y bombo):
//   B1 campeones de liga · B2 subcampeones · B3 terceros · B4 campeones de copa
//   (o 4º clasificado cuando el campeón de copa ya está por liga → pase al 4º).
// Fase de liga: 8 jornadas × 20 partidos = 160. Cada equipo: 8 rivales distintos,
// 2 de cada bombo (1 en casa y 1 fuera), nunca contra su misma región.
// CONSTRUCCIÓN CON PRUEBA DE EXISTENCIA (sin aleatoriedad ciega):
//   · Auto-pareja de bombo (b,b): ciclo de 10 sobre una permutación σ de regiones →
//     2 rivales del propio bombo, 1 en casa y 1 fuera (grado 2, venues equilibrados).
//   · Pareja cruzada (b,b'): ciclo alterno de 20 con σ (bombo b) y τ (bombo b')
//     validando τ_i ∉ {σ_i, σ_(i+1)} → garantiza que nunca coinciden regiones.
//   · Asignación a 8 jornadas = 1-factorización por coloración de aristas con
//     backtracking (matching perfecto por jornada; el grafo es 8-regular sobre 40).
// Eliminatorias: playoff 9º-24º (9v24..16v17), octavos, cuartos, semis ida/vuelta,
// final a partido único; cuadro fijo desde cuartos; sin gol de visitante;
// empate global → prórroga y penaltis en la vuelta (reserva de peor caso).

import { mulberry32, perm, seedFromString, shuffled, type Rng } from "./rng";
import type { MatchInput } from "./types";
import type { SeasonConfig } from "./config";

export interface WcParticipant {
  clubId: string;
  region: number;
  bombo: 1 | 2 | 3 | 4;
}

interface WcEdge {
  key: string;
  home: string;
  away: string;
  bomboHome: number;
  bomboAway: number;
  jornada: number; // 0 = sin asignar
}

const other = (e: WcEdge, t: string) => (e.home === t ? e.away : e.home);

/** Temporada 1: sin temporadas previas. Modo "ranking": por región se clasifican
 * los 16 de primera con orden determinista con semilla; los 4 primeros de cada
 * región van a B1..B4 (un club por región y bombo → vale la construcción cíclica).
 * Modo "draw": ídem pero con baraja pura. (Season ≥2 usa qualifyFromPrior.) */
export function qualifySeason1(cfg: SeasonConfig, div1ClubsByRegion: Map<number, string[]>): WcParticipant[] {
  const out: WcParticipant[] = [];
  for (let region = 1; region <= cfg.world.regions; region++) {
    const clubs = div1ClubsByRegion.get(region) ?? [];
    if (clubs.length < 4) throw new Error(`Región ${region} sin 4 clubes de primera`);
    const rng = mulberry32(seedFromString(`${cfg.seed}|S${cfg.season.number}|WC|QUAL|R${region}`));
    const ranked =
      cfg.worldcup.season1Mode === "ranking"
        ? shuffled(clubs, rng) // "ranking inicial" determinista con semilla (no hay ELO en el dominio puro)
        : shuffled(clubs, rng);
    for (let k = 0; k < 4; k++) {
      out.push({ clubId: ranked[k]!, region, bombo: (k + 1) as 1 | 2 | 3 | 4 });
    }
  }
  return out;
}

/** Temporada ≥2: top-3 de cada primera + campeones de copa; pase al 4º cuando
 * el campeón de copa ya está entre los 3 primeros de su liga. */
export function qualifyFromPrior(
  cfg: SeasonConfig,
  tablesDiv1ByRegion: Map<number, { team: string }[]>, // orden final 1º..Nº
  cupChampions: { region: number; clubId: string }[],
): { participants: WcParticipant[]; passDowns: { region: number; out: string; in: string }[] } {
  const participants: WcParticipant[] = [];
  const passDowns: { region: number; out: string; in: string }[] = [];
  for (let region = 1; region <= cfg.world.regions; region++) {
    const table = tablesDiv1ByRegion.get(region) ?? [];
    const q = cfg.worldcup.qualifyPerRegion;
    for (let k = 0; k < q; k++) {
      participants.push({ clubId: table[k]!.team, region, bombo: (k + 1) as 1 | 2 | 3 | 4 });
    }
  }
  for (const champ of cupChampions) {
    const clash = participants.find((p) => p.clubId === champ.clubId);
    if (!clash) {
      participants.push({ clubId: champ.clubId, region: champ.region, bombo: 4 });
    } else {
      // el campeón conserva su plaza por liga; la plaza de CAMPEÓN DE COPA (bombo 4)
      // pasa al 4º clasificado de esa primera
      const table = tablesDiv1ByRegion.get(champ.region) ?? [];
      const q = cfg.worldcup.qualifyPerRegion;
      const fourth = table[q]?.team;
      if (!fourth) throw new Error(`Región ${champ.region} sin 4º clasificado para el pase`);
      participants.push({ clubId: fourth, region: champ.region, bombo: 4 });
      passDowns.push({ region: champ.region, out: champ.clubId, in: fourth });
    }
  }
  if (participants.length !== 40) throw new Error(`Mundial debe tener 40 participantes, hay ${participants.length}`);
  return { participants, passDowns };
}

/** Permutación τ válida frente a σ: τ_i ∉ {σ_i, σ_(i+1)} para todo i (mod 10). */
function validTau(sigma: number[], rng: Rng): number[] {
  const n = sigma.length;
  for (let attempt = 0; attempt < 200; attempt++) {
    const tau = perm(n, rng);
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (tau[i] === sigma[i] || tau[i] === sigma[(i + 1) % n]) {
        ok = false;
        break;
      }
    }
    if (ok) return tau;
  }
  throw new Error("Sin permutación τ válida (no debería ocurrir: cada posición excluye 2 de 10)");
}

/** Aristas de la fase de liga por parejas de bombos (auto y cruzadas). */
function buildEdges(parts: WcParticipant[], seed: string): WcEdge[] {
  const rng = mulberry32(seedFromString(seed));
  const byBombo = (b: number) => parts.filter((p) => p.bombo === b);
  const edges: WcEdge[] = [];
  const push = (home: WcParticipant, away: WcParticipant, jornada = 0) =>
    edges.push({
      key: `${home.clubId}|${away.clubId}`,
      home: home.clubId,
      away: away.clubId,
      bomboHome: home.bombo,
      bomboAway: away.bombo,
      jornada,
    });

  const bombos = [1, 2, 3, 4];
  // auto-parejas (b,b): ciclo de 10
  for (const b of bombos) {
    const T = byBombo(b);
    const sigma = perm(T.length, rng);
    for (let i = 0; i < T.length; i++) {
      push(T[sigma[i]!]!, T[sigma[(i + 1) % T.length]!]!);
    }
  }
  // parejas cruzadas (b,b'): ciclo alterno de 20
  for (let x = 0; x < bombos.length; x++) {
    for (let y = x + 1; y < bombos.length; y++) {
      const A = byBombo(bombos[x]!);
      const B = byBombo(bombos[y]!);
      const sigma = perm(A.length, rng);
      const tau = validTau(sigma, rng);
      for (let i = 0; i < A.length; i++) {
        const a1 = A[sigma[i]!]!;
        const b1 = B[tau[i]!]!;
        const a2 = A[sigma[(i + 1) % A.length]!]!;
        push(a1, b1); // a1 casa
        push(b1, a2); // b1 casa
      }
    }
  }
  return edges;
}

/** Matching perfecto con backtracking (determinista con semilla). */
function perfectMatching(edges: WcEdge[], available: Set<string>, teams: string[], rng: Rng): WcEdge[] | null {
  const byTeam = new Map<string, WcEdge[]>();
  for (const t of teams) byTeam.set(t, []);
  for (const e of edges) {
    if (available.has(e.key)) {
      byTeam.get(e.home)!.push(e);
      byTeam.get(e.away)!.push(e);
    }
  }
  const chosen = new Map<string, WcEdge>();
  const bt = (): boolean => {
    const t = teams.find((x) => !chosen.has(x));
    if (!t) return true;
    const cands = shuffled(byTeam.get(t)!.filter((e) => !chosen.has(other(e, t))), rng);
    for (const e of cands) {
      chosen.set(t, e);
      chosen.set(other(e, t), e);
      if (bt()) return true;
      chosen.delete(t);
      chosen.delete(other(e, t));
    }
    return false;
  };
  if (!bt()) return null;
  return [...new Set(chosen.values())];
}

/** 1-factorización: reparte las 160 aristas en 8 jornadas perfectas (20 partidos).
 * El grafo es 8-regular sobre 40 vértices pero NO bipartito (hay aristas dentro
 * de cada bombo), así que la extracción golosa de un factor puede atascarse en
 * una 2-factorización con ciclos impares. Solución: retroceso entre jornadas con
 * reinicios sembrados (determinista) — con este grafo denso converge de inmediato. */
function assignJornadas(edges: WcEdge[], seed: string, jornadas = 8): void {
  const teams = [...new Set(edges.flatMap((e) => [e.home, e.away] as const))].sort();
  const available0 = new Set(edges.map((e) => e.key));

  const tryAssign = (outer: number): boolean => {
    const available = new Set(available0);
    for (let j = 1; j <= jornadas; j++) {
      let placed = false;
      for (let attempt = 0; attempt < 64 && !placed; attempt++) {
        const rng = mulberry32(seedFromString(`${seed}|FACTOR|${outer}|${j}|${attempt}`));
        const m = perfectMatching(edges, available, teams, rng);
        if (m && m.length * 2 === teams.length) {
          for (const e of m) {
            e.jornada = j;
            available.delete(e.key);
          }
          placed = true;
        }
      }
      if (!placed) return false;
    }
    return available.size === 0;
  };

  for (let outer = 0; outer < 32; outer++) {
    for (const e of edges) e.jornada = 0;
    if (tryAssign(outer)) return;
  }
  throw new Error("Sin 1-factorización del calendario del Mundial tras 32 reinicios");
}

export interface WcLeagueDraw {
  matches: { home: string; away: string; jornada: number; bomboHome: number; bomboAway: number }[];
}

/** Sorteo completo de la fase de liga (determinista, auditable). */
export function drawWcLeaguePhase(cfg: SeasonConfig, participants: WcParticipant[]): WcLeagueDraw {
  const seed = `${cfg.seed}|S${cfg.season.number}|WC|LEAGUE`;
  const edges = buildEdges(participants, seed);
  assignJornadas(edges, seed, cfg.worldcup.leagueDays.length);
  // sanity estructural
  if (edges.length !== 160) throw new Error(`Fase de liga debe tener 160 partidos, hay ${edges.length}`);
  return {
    matches: edges
      .map((e) => ({ home: e.home, away: e.away, jornada: e.jornada, bomboHome: e.bomboHome, bomboAway: e.bomboAway }))
      .sort((a, b) => a.jornada - b.jornada || a.home.localeCompare(b.home)),
  };
}

/** Emparejamientos del playoff (cabezas 9º-16º vs 17º-24º): 9v24, 10v23, ..., 16v17. */
export function playoffPairs(): [number, number][] {
  const pairs: [number, number][] = [];
  for (let s = 9; s <= 16; s++) pairs.push([s, 33 - s]); // 9↔24 ... 16↔17 (9+24 = 33)
  return pairs;
}

/** Cuadro fijo de octavos: el seed s (1º-8º) recibe al ganador del playoff
 * 8−s+1... plantilla determinista: 1º vs ganador del 16v17, 2º vs 15v18, etc. */
export function r16Template(): [number, number][] {
  // [seed directo 1..8, índice de playoff 1..8 (1 = 9v24, ..., 8 = 16v17)]
  return [
    [1, 8], [2, 7], [3, 6], [4, 5], [5, 4], [6, 3], [7, 2], [8, 1],
  ];
}

/** Placeholders de todas las eliminatorias del Mundial (huecos reservados). */
export function generateWcKnockoutPlaceholders(cfg: SeasonConfig): MatchInput[] {
  const spec: [string, number][] = [
    ["PO-I", 8], ["PO-II", 8], ["O16-I", 8], ["O16-II", 8],
    ["QF-I", 4], ["QF-II", 4], ["SF-I", 2], ["SF-II", 2], ["F", 1],
  ];
  const out: MatchInput[] = [];
  let i = 0;
  for (const [stage, n] of spec) {
    const day = cfg.worldcup.knockoutDays[stage]!;
    for (let k = 0; k < n; k++) {
      i++;
      out.push({
        key: `W|${stage}|${k + 1}`,
        competition: "MUNDIAL",
        region: null,
        division: null,
        round: stage,
        leg: stage.endsWith("-I") ? 1 : stage.endsWith("-II") ? 2 : 0,
        home: "TBD",
        away: "TBD",
        day,
        ko: true,
        placeholder: true,
      });
    }
  }
  return out;
}

export function generateWcLeagueFixtures(cfg: SeasonConfig, draw: WcLeagueDraw): MatchInput[] {
  return draw.matches.map((m) => ({
    key: `W|L${m.jornada}|${m.home}|${m.away}`,
    competition: "MUNDIAL" as const,
    region: null,
    division: null,
    round: `L${m.jornada}`,
    leg: 0,
    home: m.home,
    away: m.away,
    day: cfg.worldcup.leagueDays[m.jornada - 1]!,
    ko: false, // fase de liga: sin prórroga → 10 min
    placeholder: false,
    bomboHome: m.bomboHome,
    bomboAway: m.bomboAway,
  }));
}
