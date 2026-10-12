// Knight FM — season engine: mundo 10×10×16 = 1600 clubes (determinista).

import type { ClubRef } from "./types";
import type { SeasonConfig } from "./config";

export function buildClubs(cfg: SeasonConfig): ClubRef[] {
  const clubs: ClubRef[] = [];
  for (let r = 1; r <= cfg.world.regions; r++) {
    for (let d = 1; d <= cfg.world.divisions; d++) {
      for (let i = 1; i <= cfg.world.clubsPerDivision; i++) {
        clubs.push({ id: `R${r}D${d}C${i}`, region: r, division: d });
      }
    }
  }
  return clubs;
}

export function clubsOfDivision(clubs: ClubRef[], region: number, division: number): ClubRef[] {
  return clubs.filter((c) => c.region === region && c.division === division);
}
