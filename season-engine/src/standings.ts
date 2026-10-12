// Knight FM — season engine: clasificaciones y desempates.
// Liga: puntos → diferencia de goles → goles a favor → enfrentamiento directo
// (minitabla entre empatados) → sorteo con semilla. Mundial: mismo orden.

import { seedFromString, mulberry32, shuffled } from "./rng";

export interface Row {
  team: string;
  pts: number;
  gf: number;
  ga: number;
}

export interface ResultIn {
  home: string;
  away: string;
  hg: number;
  ag: number;
}

export function emptyTable(teams: string[]): Row[] {
  return teams.map((team) => ({ team, pts: 0, gf: 0, ga: 0 }));
}

export function applyResult(table: Row[], r: ResultIn): void {
  const h = table.find((x) => x.team === r.home);
  const a = table.find((x) => x.team === r.away);
  if (!h || !a) throw new Error(`Equipo fuera de tabla: ${r.home} / ${r.away}`);
  h.gf += r.hg;
  h.ga += r.ag;
  a.gf += r.ag;
  a.ga += r.hg;
  if (r.hg > r.ag) h.pts += 3;
  else if (r.hg < r.ag) a.pts += 3;
  else {
    h.pts += 1;
    a.pts += 1;
  }
}

const cmpBasic = (x: Row, y: Row): number => y.pts - x.pts || y.gf - y.ga - (x.gf - x.ga) || y.gf - x.gf;

/**
 * Orden final determinista. Desempates en cascada:
 *  1) puntos 2) DG 3) GF 4) minitabla de enfrentamientos directos entre el grupo
 *  empatado 5) sorteo con semilla (auditable, estable para la misma temporada).
 */
export function rankTable(rows: Row[], results: ResultIn[], seed: string): Row[] {
  const sorted = [...rows].sort(cmpBasic);
  const out: Row[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && cmpBasic(sorted[i]!, sorted[j + 1]!) === 0) j++;
    const group = sorted.slice(i, j + 1);
    if (group.length === 1) {
      out.push(group[0]!);
    } else {
      out.push(...rankTiedGroup(group, results, seed));
    }
    i = j + 1;
  }
  return out;
}

function rankTiedGroup(group: Row[], results: ResultIn[], seed: string): Row[] {
  const ids = new Set(group.map((g) => g.team));
  const direct = results.filter((r) => ids.has(r.home) && ids.has(r.away));
  if (direct.length > 0) {
    const mini = new Map(group.map((g) => [g.team, { team: g.team, pts: 0, gf: 0, ga: 0 } as Row]));
    for (const r of direct) applyResult([...mini.values()], r);
    const miniRows = [...mini.values()];
    const stillTied = new Set<string>();
    const order: Row[] = [];
    let rest = miniRows.sort(cmpBasic);
    // la minitabla solo decide si separa de verdad; si hay sub-empates → sorteo
    let separated = true;
    for (let k = 1; k < rest.length; k++) {
      if (cmpBasic(rest[k - 1]!, rest[k]!) === 0) {
        separated = false;
        stillTied.add(rest[k]!.team);
        stillTied.add(rest[k - 1]!.team);
      }
    }
    if (separated) {
      // preservar el orden básico completo usando la minitabla como desempate
      return [...group].sort((x, y) => {
        const mx = miniRows.find((r) => r.team === x.team)!;
        const my = miniRows.find((r) => r.team === y.team)!;
        return cmpBasic(mx, my);
      });
    }
    void order;
  }
  // sorteo con semilla (paso final del enunciado)
  const rng = mulberry32(seedFromString(`${seed}|TIEBREAK|${[...ids].sort().join(",")}`));
  return shuffled(group, rng);
}

/** Clasificación de una tabla ya ordenada por posición (1 = primero). */
export function positionOf(table: Row[], team: string): number {
  const idx = table.findIndex((r) => r.team === team);
  if (idx < 0) throw new Error(`${team} no está en la tabla`);
  return idx + 1;
}
