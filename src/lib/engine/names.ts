// Knight FM — neutral name generation for clubs and players (no real-world entities).

// Region identity keys (Task 23-c). The translated VALUES are believable,
// natural proper names (Valdoria, Monteverde…) shared across all languages —
// fictional places that read like real geography instead of the old generic
// "Central Region / East Coast" labels. Index order matches the seeded world.
export const REGION_NAME_KEYS = [
  "region.valdoria", "region.monteverde", "region.costaSerena", "region.rioClaro",
  "region.sierraBrava", "region.puertoCanelo", "region.lagunaEsmeralda", "region.llanuras",
  "region.altamira", "region.nuevaAurora",
];

const CLUB_PREFIX = ["Atlético", "Deportivo", "Unión", "Real", "Club", "Racing", "Sporting", "CD", "CF", "Nueva"];
const CLUB_CORE = ["Sierra", "Valle", "Lago", "Costa", "Norte", "Puerto", "Cumbre", "Río", "Pradera", "Roble",
  "Cedro", "Águila", "Toro", "Lince", "Halcón", "Zorro", "Ciervo", "Lobo", "Oso", "Faro",
  "Torre", "Puente", "Vega", "Bruma", "Trueno", "Relámpago", "Centella", "Aurora", "Estrella", "Cometa"];
const CLUB_SUFFIX = ["FC", "United", "CF", "SC", "CA", "AC", "1927", "1934", "1948", "Olímpico"];

export function generateClubName(rng: () => number, index: number): string {
  const p = CLUB_PREFIX[Math.floor(rng() * CLUB_PREFIX.length)];
  const c = CLUB_CORE[Math.floor(rng() * CLUB_CORE.length)];
  const s = CLUB_SUFFIX[Math.floor(rng() * CLUB_SUFFIX.length)];
  const style = Math.floor(rng() * 3);
  if (style === 0) return `${p} ${c}`;
  if (style === 1) return `${c} ${s}`;
  return `${p} ${c} ${s}`.replace(/FC FC|CF CF/g, "FC") + (style === 2 ? ` ${index % 9 === 0 ? "B" : ""}`.trimEnd() : "");
}

const FIRST_NAMES = ["Adrián", "Bruno", "Carles", "Diego", "Emiliano", "Fabio", "Gonzalo", "Hugo", "Iván", "Joaquín",
  "Kevin", "Lucas", "Mateo", "Nicolás", "Óscar", "Pablo", "Ramón", "Sergio", "Tomás", "Ulises",
  "Víctor", "Yago", "Zacarías", "Álvaro", "Óliver", "Rubén", "Andrés", "Beltrán", "Cristian", "Damián",
  "Enzo", "Fermín", "Gael", "Héctor", "Ignacio", "Julián", "Leandro", "Marcos", "Néstor", "Oriol"];
const LAST_NAMES = ["Aguilar", "Bravo", "Cordero", "Duarte", "Escobar", "Ferrer", "Gallardo", "Herrera", "Ibarra",
  "Juárez", "Quiroga", "Lombardi", "Montoya", "Navarro", "Otero", "Peralta", "Quintana", "Ríos",
  "Salazar", "Trujillo", "Urbina", "Valverde", "Zamora", "Cabrera", "Delgado", "Estévez", "Fuentes",
  "Guzmán", "Haros", "Iglesias"];

export function generatePlayerName(rng: () => number): { firstName: string; lastName: string } {
  return {
    firstName: FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)],
    lastName: LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)],
  };
}
