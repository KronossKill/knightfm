// Knight FM — shared domain types & constants (spec §7, §8, §12, §15, §22)

export type Role = "USER" | "ADMIN";
export type ManagerPath = "MANAGER" | "OWNER";

export type Position = "GK" | "DF" | "MF" | "FW";
export type DetailedPos =
  | "GK" | "CB" | "LB" | "RB" | "DM" | "CM" | "AM" | "LM" | "RM" | "LW" | "RW" | "ST";

export const POSITIONS: Position[] = ["GK", "DF", "MF", "FW"];

export type AttributeFamily = "technical" | "physical" | "mental";

export interface PlayerAttributes {
  technical: Record<string, number>;
  physical: Record<string, number>;
  mental: Record<string, number>;
}

export const ATTRIBUTE_KEYS: Record<AttributeFamily, string[]> = {
  technical: ["finishing", "passing", "firstTouch", "tackling", "dribbling", "crossing", "heading", "handling", "kicking", "setPieces"],
  physical: ["pace", "acceleration", "stamina", "strength", "agility", "balance", "jumping", "recovery"],
  mental: ["decisions", "anticipation", "positioning", "composure", "concentration", "bravery", "workRate", "reactions", "leadership"],
};

export const FACILITY_TYPES = [
  "STADIUM",
  "TRAINING_CENTER",
  "YOUTH_ACADEMY",
  "MEDICAL_CENTER",
  "SPORTS_SCIENCE",
  "REST_ROOMS",
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const FORMATIONS = ["4-4-2", "4-3-3", "4-5-1", "5-3-2", "5-4-1", "3-4-3", "3-5-2"] as const;
export type Formation = (typeof FORMATIONS)[number];

// Formation slot layout: slotId -> { pos, x, y } on a 0..100 pitch grid (x: 0=own goal line .. 100=opponent)
export interface FormationSlot { id: string; pos: Position; label: string; x: number; y: number }

export const FORMATION_LAYOUTS: Record<Formation, FormationSlot[]> = {
  "4-4-2": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "LB", pos: "DF", label: "LB", x: 26, y: 15 }, { id: "CB1", pos: "DF", label: "CB", x: 22, y: 38 },
    { id: "CB2", pos: "DF", label: "CB", x: 22, y: 62 }, { id: "RB", pos: "DF", label: "RB", x: 26, y: 85 },
    { id: "LM", pos: "MF", label: "LM", x: 52, y: 15 }, { id: "CM1", pos: "MF", label: "CM", x: 48, y: 38 },
    { id: "CM2", pos: "MF", label: "CM", x: 48, y: 62 }, { id: "RM", pos: "MF", label: "RM", x: 52, y: 85 },
    { id: "ST1", pos: "FW", label: "ST", x: 80, y: 38 }, { id: "ST2", pos: "FW", label: "ST", x: 80, y: 62 },
  ],
  "4-3-3": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "LB", pos: "DF", label: "LB", x: 26, y: 15 }, { id: "CB1", pos: "DF", label: "CB", x: 22, y: 38 },
    { id: "CB2", pos: "DF", label: "CB", x: 22, y: 62 }, { id: "RB", pos: "DF", label: "RB", x: 26, y: 85 },
    { id: "CM1", pos: "MF", label: "CM", x: 46, y: 30 }, { id: "CM2", pos: "MF", label: "CM", x: 44, y: 50 },
    { id: "CM3", pos: "MF", label: "CM", x: 46, y: 70 },
    { id: "LW", pos: "FW", label: "LW", x: 76, y: 18 }, { id: "ST", pos: "FW", label: "ST", x: 82, y: 50 },
    { id: "RW", pos: "FW", label: "RW", x: 76, y: 82 },
  ],
  "4-5-1": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "LB", pos: "DF", label: "LB", x: 26, y: 15 }, { id: "CB1", pos: "DF", label: "CB", x: 22, y: 38 },
    { id: "CB2", pos: "DF", label: "CB", x: 22, y: 62 }, { id: "RB", pos: "DF", label: "RB", x: 26, y: 85 },
    { id: "LM", pos: "MF", label: "LM", x: 52, y: 12 }, { id: "CM1", pos: "MF", label: "CM", x: 47, y: 34 },
    { id: "CDM", pos: "MF", label: "DM", x: 40, y: 50 }, { id: "CM2", pos: "MF", label: "CM", x: 47, y: 66 },
    { id: "RM", pos: "MF", label: "RM", x: 52, y: 88 },
    { id: "ST", pos: "FW", label: "ST", x: 82, y: 50 },
  ],
  "5-3-2": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "LWB", pos: "DF", label: "LWB", x: 28, y: 10 }, { id: "CB1", pos: "DF", label: "CB", x: 20, y: 32 },
    { id: "CB2", pos: "DF", label: "CB", x: 18, y: 50 }, { id: "CB3", pos: "DF", label: "CB", x: 20, y: 68 },
    { id: "RWB", pos: "DF", label: "RWB", x: 28, y: 90 },
    { id: "CM1", pos: "MF", label: "CM", x: 48, y: 30 }, { id: "CM2", pos: "MF", label: "CM", x: 45, y: 50 },
    { id: "CM3", pos: "MF", label: "CM", x: 48, y: 70 },
    { id: "ST1", pos: "FW", label: "ST", x: 78, y: 38 }, { id: "ST2", pos: "FW", label: "ST", x: 78, y: 62 },
  ],
  "5-4-1": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "LWB", pos: "DF", label: "LWB", x: 28, y: 10 }, { id: "CB1", pos: "DF", label: "CB", x: 20, y: 32 },
    { id: "CB2", pos: "DF", label: "CB", x: 18, y: 50 }, { id: "CB3", pos: "DF", label: "CB", x: 20, y: 68 },
    { id: "RWB", pos: "DF", label: "RWB", x: 28, y: 90 },
    { id: "LM", pos: "MF", label: "LM", x: 52, y: 14 }, { id: "CM1", pos: "MF", label: "CM", x: 47, y: 38 },
    { id: "CM2", pos: "MF", label: "CM", x: 47, y: 62 }, { id: "RM", pos: "MF", label: "RM", x: 52, y: 86 },
    { id: "ST", pos: "FW", label: "ST", x: 82, y: 50 },
  ],
  "3-4-3": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "CB1", pos: "DF", label: "CB", x: 22, y: 28 }, { id: "CB2", pos: "DF", label: "CB", x: 19, y: 50 },
    { id: "CB3", pos: "DF", label: "CB", x: 22, y: 72 },
    { id: "LM", pos: "MF", label: "LM", x: 50, y: 12 }, { id: "CM1", pos: "MF", label: "CM", x: 46, y: 38 },
    { id: "CM2", pos: "MF", label: "CM", x: 46, y: 62 }, { id: "RM", pos: "MF", label: "RM", x: 50, y: 88 },
    { id: "LW", pos: "FW", label: "LW", x: 78, y: 22 }, { id: "ST", pos: "FW", label: "ST", x: 82, y: 50 },
    { id: "RW", pos: "FW", label: "RW", x: 78, y: 78 },
  ],
  "3-5-2": [
    { id: "GK", pos: "GK", label: "GK", x: 6, y: 50 },
    { id: "CB1", pos: "DF", label: "CB", x: 22, y: 28 }, { id: "CB2", pos: "DF", label: "CB", x: 19, y: 50 },
    { id: "CB3", pos: "DF", label: "CB", x: 22, y: 72 },
    { id: "LM", pos: "MF", label: "LM", x: 52, y: 10 }, { id: "CM1", pos: "MF", label: "CM", x: 46, y: 32 },
    { id: "CDM", pos: "MF", label: "DM", x: 40, y: 50 }, { id: "CM2", pos: "MF", label: "CM", x: 46, y: 68 },
    { id: "RM", pos: "MF", label: "RM", x: 52, y: 90 },
    { id: "ST1", pos: "FW", label: "ST", x: 80, y: 38 }, { id: "ST2", pos: "FW", label: "ST", x: 80, y: 62 },
  ],
};

export type Competition = "LEAGUE" | "REGIONAL_CUP" | "WORLD_CHAMPIONSHIP" | "FRIENDLY";
export type FinState = "HEALTHY" | "INSOLVENT" | "POSSIBLE_BANKRUPTCY" | "BANKRUPT";

export type TrainingGeneral = "balanced" | "physical" | "technical" | "mental" | "recovery";
export type TrainingSpecial = "goalkeeper" | "defense" | "midfield" | "wide" | "attack" | "physical" | "set_pieces" | "none";

export const COACH_SPECIALIZATIONS: Record<string, string[]> = {
  goalkeeper: ["handling", "kicking", "reactions", "positioning"],
  defense: ["tackling", "positioning", "anticipation", "strength"],
  midfield: ["passing", "decisions", "workRate", "firstTouch"],
  wide: ["crossing", "dribbling", "pace", "stamina"],
  attack: ["finishing", "anticipation", "composure", "heading"],
  physical: ["stamina", "strength", "acceleration", "recovery"],
  set_pieces: ["setPieces", "kicking", "heading", "passing"],
};

export const SEASON_COMPETITIVE_DAYS = 32;
export const SEASON_PRESEASON_DAYS = 5;
export const SEASON_TOTAL_DAYS = SEASON_COMPETITIVE_DAYS + SEASON_PRESEASON_DAYS; // 37

export const LEDGER_CATEGORIES = [
  "SALARY_PLAYER", "SALARY_MANAGER", "TRANSFER_IN", "TRANSFER_OUT", "PURCHASE_CLUB",
  "PRIZE", "FACILITY", "INVEST", "WITHDRAW", "LEVY", "REFERRAL", "FRIENDLY_FEE",
  "DISMISSAL", "RELEASE_SETTLEMENT", "ALLOCATION_REGIONAL", "ALLOCATION_SYSTEM",
  "DEPOSIT", "WITHDRAWAL_CRYPTO", "TRAINING", "YOUTH", "OTHER",
] as const;
