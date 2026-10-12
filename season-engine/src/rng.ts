// Knight FM — season engine: RNG determinista (FNV-1a + mulberry32) y utilidades.
// Toda la aleatoriedad del motor pasa por aquí: semilla por (temporada, competición,
// ronda) → flujos reproducibles y auditables.

/** FNV-1a 32-bit: string → semilla numérica estable. */
export function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32: rápido, determinista, calidad suficiente para sorteos. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** Fisher-Yates determinista sobre copia (no muta la entrada). */
export function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

/** Permutación de 0..n-1 determinista. */
export function perm(n: number, rng: Rng): number[] {
  return shuffled([...Array(n).keys()], rng);
}
