// Knight FM — account lifecycle & season anchor (FR).

export const dict: Record<string, string> = {
  // ── Season anchor (world clock) ─────────────────────────────────
  "lifecycle.season.title": "Début du monde (ancre de la 1re saison)",
  "lifecycle.season.desc":
    "Le jour 1 du monde démarre à cette date UTC. Définir l'ancre redéfinit le compteur de jours de jeu : à réserver à la correction du début de la 1re saison.",
  "lifecycle.season.currentAnchor": "Ancre actuelle (UTC)",
  "lifecycle.season.gameDay": "Jour de jeu actuel",
  "lifecycle.season.activeSeason": "Saison active",
  "lifecycle.season.seasonN": "Saison {n}",
  "lifecycle.season.none": "Aucune saison active",
  "lifecycle.season.dateLabel": "Nouvelle date de début (UTC)",
  "lifecycle.season.setButton": "Définir le début de la 1re saison",
  "lifecycle.season.setDone": "Monde ancré au {date}. Jour de jeu actuel : {day}.",
  "lifecycle.season.forceTitle": "Ré-ancrer le monde ?",
  "lifecycle.season.forceDesc":
    "Des saisons existent déjà. Ré-ancrer réinitialise le compteur de jours du monde et remanie la saison en cours, ses calendriers et ses contrats. L'action est consignée dans l'audit.",
  "lifecycle.season.forceCheck": "Je comprends, ré-ancrer",
  "lifecycle.season.forceConfirm": "Ré-ancrer le monde",
  "lifecycle.season.error": "Impossible de définir l'ancre du monde",

  // ── Inactivity policy ──────────────────────────────────────────
  "lifecycle.inactivity.title": "Cycle de vie des comptes",
  "lifecycle.inactivity.desc":
    "Tâche quotidienne (00:20 UTC) : les comptes sans connexion sont marqués INACTIFS puis purgés. Les clubs des propriétaires supprimés reviennent au système sous leur nom d'origine ; les clubs dirigés perdent leur manager et leur contrat est résilié.",
  "lifecycle.inactivity.policy":
    "Comptes : INACTIF après {a} jours, supprimé après {b} — les administrateurs n'expirent jamais.",
  "lifecycle.inactivity.policyUnknown":
    "Les comptes inactifs sont marqués INACTIFS puis supprimés ; les administrateurs n'expirent jamais.",
};
