// Knight FM — account lifecycle & season anchor (EN).

export const dict: Record<string, string> = {
  // ── Season anchor (world clock) ─────────────────────────────────
  "lifecycle.season.title": "World start (season 1 anchor)",
  "lifecycle.season.desc":
    "Game day 1 begins on this UTC date. Setting the anchor redefines the game-day counter: use it only to correct the start of the 1st season.",
  "lifecycle.season.currentAnchor": "Current anchor (UTC)",
  "lifecycle.season.gameDay": "Current game day",
  "lifecycle.season.activeSeason": "Active season",
  "lifecycle.season.seasonN": "Season {n}",
  "lifecycle.season.none": "No active season",
  "lifecycle.season.dateLabel": "New start date (UTC)",
  "lifecycle.season.setButton": "Set 1st season start",
  "lifecycle.season.setDone": "World anchored to {date}. Current game day: {day}.",
  "lifecycle.season.forceTitle": "Re-anchor the world?",
  "lifecycle.season.forceDesc":
    "Seasons already exist. Re-anchoring resets the world's game-day counter and remaps the running season, its calendars and contracts. The action is recorded in the audit log.",
  "lifecycle.season.forceCheck": "I understand, re-anchor",
  "lifecycle.season.forceConfirm": "Re-anchor the world",
  "lifecycle.season.error": "Could not set the world anchor",

  // ── Inactivity policy ──────────────────────────────────────────
  "lifecycle.inactivity.title": "Account lifecycle",
  "lifecycle.inactivity.desc":
    "Daily job (00:20 UTC): accounts without access are marked INACTIVE and later swept. Clubs of deleted owners return to the system under their original name; managed clubs lose their manager and the contract is terminated.",
  "lifecycle.inactivity.policy":
    "Accounts: INACTIVE after {a} days, deleted after {b} — administrators never expire.",
  "lifecycle.inactivity.policyUnknown":
    "Inactive accounts are marked INACTIVE and later deleted; administrators never expire.",
};
