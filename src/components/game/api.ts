"use client";
// Knight FM — client-side API contract layer for the game shell (Task 4-a).
// All calls go through `apiFetch` from the auth store (adds Bearer, unwraps the
// {ok,data}|{ok,error} envelope, single-flight refresh on 401). Types mirror the
// server response shapes defined by Tasks 2-a / 3-a / 3-b EXACTLY.

import { apiFetch } from "@/components/auth/store";

// ── Shared primitives ───────────────────────────────────────────

export interface Brand {
  primaryColor: string;
  secondaryColor: string;
  initials: string;
  badgeShape: string;
  /** Task 24-a: served by club/mine + club/[id]; older selects may omit it (client falls back to "solid"). */
  crestPattern?: string;
}

export type Position = "GK" | "DF" | "MF" | "FW";
export type Trend = "up" | "down" | "flat";

export interface ClubRef {
  id: string;
  name: string;
  brand: Pick<Brand, "initials" | "primaryColor" | "secondaryColor"> | null;
}

// ── /api/world/state + /api/presence/summary ────────────────────

export interface WorldState {
  gameDay: number;
  utcNow: string;
  season: {
    number: number;
    state: string;
    seasonDay?: number;
    preseasonDay?: number;
    startEpochDay: number;
    endEpochDay: number;
  } | null;
  /** Post-reset pre-season: the scheduled season that has NOT started yet. */
  nextSeason: {
    number: number;
    startEpochDay: number;
    startsInDays: number;
  } | null;
  maintenance: { enabled: boolean; message: string };
  nextKickoffUtc: string;
  presenceOnline: number;
  /** Effective $Knight→USD rate (detected source or manual admin config); null = hidden. */
  knightUsd: { cents: number; source: "oracle" | "manual" } | null;
}

export interface PresenceSummary {
  online: number;
  weekly: number;
  monthly: number;
  yearly: number;
  at: string;
}

// ── /api/world/regions ──────────────────────────────────────────

export interface Region {
  id: string;
  index: number;
  nameKey: string;
  clubCount: number;
  divisions: { id: string; index: number }[];
}

// ── /api/club/mine ──────────────────────────────────────────────

export interface ManagerContractView {
  totalAmount: number;
  durationDays: number;
  dailySalary: number;
  startDay: number;
  endDay: number;
  state: string;
}

export interface NextFixtureView {
  id: string;
  competition: string;
  round: string | null;
  stage: string | null;
  kickoffUtc: string;
  isHome: boolean;
  opponentId: string;
  opponentName: string;
}

export interface ClubMine {
  id: string;
  name: string;
  /** Immutable founding name — restored when the club returns to the system (Task 24-a). */
  originalName: string;
  /** Absolute game day of the last rename (null = never renamed). */
  nameChangeDay: number | null;
  systemOwned: boolean;
  role: "OWNER" | "MANAGER";
  brand: Brand | null;
  regionId: string;
  regionNameKey: string;
  divisionId: string;
  divisionIndex: number;
  operatingFund: number;
  debt: number;
  finState: "HEALTHY" | "INSOLVENT" | "POSSIBLE_BANKRUPTCY" | "BANKRUPT";
  capacity: { icp: number; bonusSlots: number; baseCapacity: number; finalCapacity: number };
  playerCount: number;
  standings: {
    position: number | null;
    points: number;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    ga: number;
  } | null;
  nextFixture: NextFixtureView | null;
  contract: ManagerContractView | null;
}

// ── /api/club/brand + /api/club/release + /api/club/[id] ───────

export type ClubBadgeShape = "shield" | "circle" | "square";
export type ClubCrestPattern =
  | "solid" | "stripes-v" | "stripes-h" | "halves" | "quarters" | "sash" | "checker";

export interface ClubBrandUpdateInput {
  clubId: string;
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  initials?: string;
  badgeShape?: ClubBadgeShape;
  crestPattern?: ClubCrestPattern;
}

export interface ClubBrandUpdateResult {
  updated: boolean;
  brand: Brand;
  club: {
    name: string;
    originalName: string;
    nameChangeDay: number | null;
    systemOwned: boolean;
  } | null;
}

export interface ClubReleaseResult {
  released: boolean;
  clubId: string;
  /** Founding name the club reverted to. */
  name: string;
}

export interface ClubProfileResponse {
  club: {
    id: string;
    name: string;
    systemOwned: boolean;
    brand: Brand | null;
    owner: { username: string } | null;
    manager: { username: string } | null;
    facilities: Record<string, number>;
    division: { id: string; index: number } | null;
    /** Durable record — survives the 2-season detail purge. */
    history: {
      titlesLeague: number;
      titlesCup: number;
      titlesWorld: number;
      won: number;
      drawn: number;
      lost: number;
    };
  };
  topPlayers: {
    id: string;
    firstName: string;
    lastName: string;
    position: Position;
    ovr: number;
    stars: number;
  }[];
  // Task 26: FULL rival squad + staff — the clause-exercise flow needs the
  // financial fields (market value, release clause) per player.
  squad: {
    id: string;
    firstName: string;
    lastName: string;
    position: Position;
    ovr: number;
    stars: number;
    age: number;
    marketValue: number;
    releaseClause: number;
    onLoan: boolean;
    // Task 27-f: availability status (suspension = remaining MATCHES,
    // injuredUntil = UTC ISO timestamp | null) for the status badges.
    suspension: number;
    injuredUntil: string | null;
    // Task 28: bookings this season (distinct matches counted once).
    yellowCards: number;
  }[];
  staff: {
    id: string;
    role: string;
    name: string;
    quality: number;
    stars: number;
    specialization: string | null;
  }[];
}

// ── /api/players + /api/players/[id] ────────────────────────────

export interface PlayerRow {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  loan?: { status: "OUT" | "IN"; untilDay: number } | null;
  position: Position;
  detailedPos: string;
  ovr: number;
  potential: number;
  stars: number;
  marketValue: number;
  salary: number;
  releaseClause: number;
  form: number;
  fatigue: number;
  sharpness: number;
  morale: number;
  confidence: number;
  injuredUntil: string | null;
  suspension: number;
  yellowCards: number;
  trendPerAttribute: Record<string, Trend>;
}

export interface PlayerDetail {
  player: {
    id: string;
    clubId?: string;
    firstName: string;
    lastName: string;
    age: number;
    position: Position;
    detailedPos?: string;
    ovr: number;
    potential?: number;
    stars: number;
    marketValue?: number;
    salary?: number;
    releaseClause?: number;
    loan?: { untilDay: number; originClubId: string | null } | null;
    attributes?: Record<string, Record<string, number>>;
    trendPerAttribute?: Record<string, Trend>;
    state?: {
      form: number;
      fatigue: number;
      sharpness: number;
      morale: number;
      confidence: number;
      injuredUntil: string | null;
      suspension: number;
      yellowCards: number;
      isFreeAgent: boolean;
      isYouth: boolean;
      retired: boolean;
    };
  };
  view: "STAFF" | "PUBLIC";
  displayName?: string;
}

// ── /api/competitions/* ─────────────────────────────────────────

export interface FixtureRow {
  id: string;
  competition: string;
  round: string | null;
  stage: string | null;
  regionId: string | null;
  matchDay: number;
  kickoffUtc: string;
  status: "SCHEDULED" | "PLAYED";
  home: ClubRef;
  away: ClubRef;
  score: { home: number; away: number } | null;
}

export interface StandingsRow {
  position: number;
  club: ClubRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface StandingsResponse {
  season: { id: string; number: number } | null;
  division: { id: string; index: number; region: { id: string; index: number; nameKey: string } } | null;
  /** Promotion / relegation / World Cup zone sizes for the viewed division
   *  (server-driven so badges can never disagree with the season engine). */
  zones?: { promotionSlots: number; relegationSlots: number; worldCupSlots: number; isLastDivision: boolean };
  standings: StandingsRow[];
}

export interface MatchEvent {
  minute: number;
  type: string;
  clubId: string | null;
  playerId: string | null;
  playerName: string | null;
  detail: string | null;
}

export interface MatchDetail {
  match: {
    id: string;
    fixtureId: string;
    playedAt: string;
    competition: string;
    round: string | null;
    stage: string | null;
    seasonNumber: number;
    kickoffUtc: string;
    home: ClubRef & { goals: number };
    away: ClubRef & { goals: number };
    stats: {
      possession: { home: number; away: number };
      shots: { home: number; away: number };
      xg: { home: number; away: number };
    };
    motm: { id: string; name: string } | null;
    events: MatchEvent[];
  };
}

export interface CupBracketMatch {
  id: string;
  home: ClubRef;
  away: ClubRef;
  score: { home: number; away: number } | null;
  status: string;
  matchDay: number;
  /** Server-resolved winner (drawn cup ties use the elimination record). */
  winner: "home" | "away" | null;
}

export interface CupRegion {
  regionId: string;
  champion: ClubRef | null;
  rounds: { round: number; eliminated: ClubRef[] }[];
  /** Pairings per round: who competes, who advanced/won, who meets whom (Task 21). */
  bracket: { round: number; stage: string | null; matches: CupBracketMatch[] }[];
  alive: ClubRef[];
  entrants: number;
}

export interface WorldCupSlot {
  club: ClubRef;
  source: string;
  points: number;
  played: number;
  gf: number;
  ga: number;
  gd: number;
  eliminatedStage: string | null;
}

export interface WorldCupResponse {
  season: { id: string; number: number } | null;
  /** USER MANDATE: false in Season 1 — the Club World Cup starts in Season 2. */
  worldCupActive: boolean;
  table: WorldCupSlot[];
  knockout: {
    id: string;
    stage: string | null;
    round: string | null;
    kickoffUtc: string;
    status: string;
    home: ClubRef;
    away: ClubRef;
    score: { home: number; away: number } | null;
    winner: "home" | "away" | null;
  }[];
}

// ── /api/training ───────────────────────────────────────────────

export type TrainingGeneral = "balanced" | "physical" | "technical" | "mental" | "recovery";
export type TrainingSpecial =
  | "goalkeeper" | "defense" | "midfield" | "wide" | "attack" | "physical" | "set_pieces" | "none";
// Special types that can actually be RUN (the plan preference may also be "none").
export type TrainingSpecialType = Exclude<TrainingSpecial, "none">;

// Today's session usage/limits (GET /api/training → usage, POST run responses).
export interface TrainingUsage {
  generalUsed: number;
  generalLimit: number;
  specialUsed: Record<string, number>;
  specialLimit: number;
}

export interface TrainingRunGeneralResult {
  ran: "general";
  focus: TrainingGeneral;
  players: number;
  /** Effective % applied to EVERY attribute of EVERY squad player. */
  pct: number;
  attrsGained: number;
  usage: TrainingUsage;
}

export interface TrainingRunSpecialResult {
  ran: "special";
  type: TrainingSpecialType;
  playerId: string;
  /** Effective % applied to the trained area's attributes of the chosen player. */
  pct: number;
  attrsGained: number;
  usage: TrainingUsage;
}

export interface TrainingResponse {
  clubId: string;
  plan: {
    generalFocus: TrainingGeneral;
    specialFocus: TrainingSpecial;
    specialTarget: string;
    updatedAt: string | null;
  };
  usage: TrainingUsage;
  academyQualityCap: number;
  /** User mandate: special sessions require technical staff (≥1 COACH). */
  canSpecial: boolean;
  coachCount: number;
}

// ── /api/staff/* ──────────────────────────────────────────────

export type StaffRole = "COACH" | "SCOUT" | "MEDIC" | "PHYSIO" | "ANALYST";

export interface StaffMember {
  id: string;
  role: StaffRole;
  name: string;
  specialization: string | null;
  quality: number;
  salary: number;
  createdAt: string;
}

export interface StaffCandidate {
  id: string;
  role: StaffRole;
  stars: number;
  name: string;
  specialization: string | null;
  quality: number;
  hireFee: number;
  salary: number;
}

export interface StaffAreaMeta {
  role: StaffRole;
  facilityType: string;
  facilityLevel: number;
  maxStars: number;
  starRequirements: Record<number, number>;
}

export interface StaffResponse {
  clubId: string;
  day: number;
  staff: StaffMember[];
  areas: StaffAreaMeta[];
  counts: Record<string, number>;
  config: { maxPerRole: number; hireCostPerQuality: number; day: number };
}

export interface StaffCandidatesResponse {
  clubId: string;
  role: StaffRole;
  stars: number;
  day: number;
  facilityLevel: number;
  candidates: StaffCandidate[];
}

export interface StaffHireResult {
  staff: StaffMember;
  fee: number;
}

export interface StaffReleaseResult {
  id: string;
  released: boolean;
  severance: number;
}

// ── /api/facilities ─────────────────────────────────────────────

export interface FacilityView {
  type: string;
  level: number;
  upgrade: {
    toLevel: number;
    startedAt: string;
    completesAt: string;
    progressPct: number;
  } | null;
  nextLevelCost: number | null;
  durationDays: number;
}

export interface FacilitiesResponse {
  clubId: string;
  config: {
    maxLevel: number;
    baseCost: number;
    upgradeDays: number;
    /** Daily fatigue reduction per REST_ROOMS level (optional; server may omit). */
    restRecoveryPerLevel?: number;
  };
  facilities: FacilityView[];
  icp: {
    icp: number;
    bonusSlots: number;
    baseCapacity: number;
    finalCapacity: number;
    weights: { training: number; medical: number; youth: number; science: number };
    playerCount: number;
  };
}

// ── /api/youth/* ────────────────────────────────────────────────

export interface YouthProspect {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: Position;
  quality: number;
  qualityRange: { min: number; max: number };
  attributes: Record<string, Record<string, number>>;
  scouted: boolean;
  reportDepth: number;
  generatedOn: number;
  promotable: boolean;
  // Old enough AND within the academy's quality cap.
  signable: boolean;
  aboveCap: boolean;
}

export interface YouthProspectsResponse {
  clubId: string;
  prospects: YouthProspect[];
  count: number;
  youthPromotionAge: number;
  academyLevel: number;
  academyQualityCap: number;
  hasScout: boolean;
  bestScout: { name: string; quality: number } | null;
  /** Task 23-a: prospects per session = the scout's star rating (1★→1 … 5★→5). */
  scoutStars?: number;
  prospectsPerSession?: number;
  day?: number;
  /** Once-per-day scout limit (Task 21): true when today's session was used. */
  scoutedToday?: boolean;
  /** Task 26: academy-level capacity of the cantera (used/space for the badge). */
  youthCapacity?: number;
  used?: number;
  capacitySpace?: number;
}

// ── /api/messages/notifications ─────────────────────────────────

export interface NotificationsResponse {
  items: {
    id: string;
    typeKey: string;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
  }[];
  unread: number;
}

// ── /api/onboarding/* ───────────────────────────────────────────

export interface OnboardingState {
  path: "MANAGER" | "OWNER" | null;
  hasManagedClub: boolean;
  hasOwnedClub: boolean;
  needsPath: boolean;
  contractPreview: null;
}

export interface OnboardingClub {
  id: string;
  name: string;
  brand: Brand | null;
  regionIndex: number;
  regionNameKey: string;
  divisionIndex: number;
  squadSize: number;
  avgOvr: number | null;
  facilitiesCount: number;
  operatingFund: number;
  price: number | null;
}

export interface OnboardingClubsResponse {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  price: number | null;
  /** Task 30: lowest selectable division index (world.pickMinDivisionIndex, default 5). */
  minDivisionIndex: number;
  clubs: OnboardingClub[];
}

export interface ContractPreview {
  club: {
    id: string;
    name: string;
    brand: Brand | null;
    regionIndex: number;
    regionNameKey: string;
    divisionIndex: number;
  };
  seasons: number;
  seasonNumber: number;
  totalAmount: number;
  durationDays: number;
  dailySalary: number;
  startDay: number;
  endDay: number;
}

// ── Query fetchers ──────────────────────────────────────────────

export const qk = {
  world: ["world", "state"] as const,
  presence: ["presence", "summary"] as const,
  regions: ["world", "regions"] as const,
  myClubs: ["club", "mine"] as const,
  me: ["auth", "me"] as const,
  notifications: ["notifications"] as const,
  onboardingState: ["onboarding", "state"] as const,
  players: (clubId: string) => ["players", clubId] as const,
  player: (id: string) => ["player", id] as const,
  training: (clubId: string) => ["training", clubId] as const,
  staff: (clubId: string) => ["staff", clubId] as const,
  staffCands: (clubId: string, role: StaffRole, stars: number, day: number) =>
    ["staff-cands", clubId, role, stars, day] as const,
  facilities: (clubId: string) => ["facilities", clubId] as const,
  youth: (clubId: string) => ["youth", clubId] as const,
  standings: (divisionId: string) => ["standings", divisionId] as const,
  fixtures: (filters: Record<string, string | number | undefined>) =>
    ["fixtures", filters] as const,
  match: (id: string) => ["match", id] as const,
  cups: (regionId: string | undefined) => ["cups", regionId ?? "all"] as const,
  worldcup: ["worldcup"] as const,
  onboardingClubs: (path: string, regionIndex: number | undefined, q: string, page: number) =>
    ["onboarding", "clubs", path, regionIndex ?? "all", q, page] as const,
  contractPreview: (clubId: string) => ["contract-preview", clubId] as const,
  club: (id: string) => ["club", id] as const,
};

export const fetchWorldState = () => apiFetch<WorldState>("/api/world/state");
export const fetchPresence = () => apiFetch<PresenceSummary>("/api/presence/summary");
export const fetchRegions = () => apiFetch<{ regions: Region[] }>("/api/world/regions");
export const fetchMyClubs = () => apiFetch<{ clubs: ClubMine[]; season: { id: string; number: number } | null }>("/api/club/mine");
export const fetchNotifications = () => apiFetch<NotificationsResponse>("/api/messages/notifications");
export const fetchOnboardingState = () => apiFetch<OnboardingState>("/api/onboarding/state");
export const fetchPlayers = (clubId: string) =>
  apiFetch<{ clubId: string; players: PlayerRow[]; count: number }>(
    `/api/players?clubId=${encodeURIComponent(clubId)}`
  );
export const fetchPlayer = (id: string) => apiFetch<PlayerDetail>(`/api/players/${encodeURIComponent(id)}`);
export const fetchTraining = (clubId: string) =>
  apiFetch<TrainingResponse>(`/api/training?clubId=${encodeURIComponent(clubId)}`);
export const fetchStaff = (clubId: string) =>
  apiFetch<StaffResponse>(`/api/staff?clubId=${encodeURIComponent(clubId)}`);
export const fetchStaffCandidates = (clubId: string, role: StaffRole, stars: number) =>
  apiFetch<StaffCandidatesResponse>(
    `/api/staff/candidates?clubId=${encodeURIComponent(clubId)}&role=${encodeURIComponent(role)}&stars=${stars}`
  );
export const fetchFacilities = (clubId: string) =>
  apiFetch<FacilitiesResponse>(`/api/facilities?clubId=${encodeURIComponent(clubId)}`);
export const fetchYouth = (clubId: string) =>
  apiFetch<YouthProspectsResponse>(`/api/youth/prospects?clubId=${encodeURIComponent(clubId)}`);
export const fetchStandings = (divisionId: string) =>
  apiFetch<StandingsResponse>(`/api/competitions/standings?divisionId=${encodeURIComponent(divisionId)}`);
export const fetchFixtures = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  return apiFetch<{ filters: Record<string, unknown>; fixtures: FixtureRow[] }>(
    `/api/competitions/fixtures?${sp.toString()}`
  );
};
export const fetchMatch = (id: string) =>
  apiFetch<MatchDetail>(`/api/competitions/match/${encodeURIComponent(id)}`);
export const fetchCups = (regionId?: string) =>
  apiFetch<{ season: { id: string; number: number } | null; regions: CupRegion[] }>(
    `/api/competitions/cups${regionId ? `?regionId=${encodeURIComponent(regionId)}` : ""}`
  );
export const fetchWorldCup = () => apiFetch<WorldCupResponse>("/api/competitions/worldcup");
export const fetchOnboardingClubs = (
  path: "MANAGER" | "OWNER",
  regionIndex: number | undefined,
  q: string,
  page: number
) => {
  const sp = new URLSearchParams({ path });
  if (regionIndex !== undefined) sp.set("regionIndex", String(regionIndex));
  if (q.trim()) sp.set("q", q.trim());
  sp.set("page", String(page));
  return apiFetch<OnboardingClubsResponse>(`/api/onboarding/clubs?${sp.toString()}`);
};
export const fetchContractPreview = (clubId: string) =>
  apiFetch<ContractPreview>("/api/onboarding/contract-preview", { method: "POST", body: { clubId } });
export const fetchClubProfile = (id: string) =>
  apiFetch<ClubProfileResponse>(`/api/club/${encodeURIComponent(id)}`);
export const fetchUpdateClubBrand = (input: ClubBrandUpdateInput) =>
  apiFetch<ClubBrandUpdateResult>("/api/club/brand", { method: "PATCH", body: input });
export const fetchReleaseClub = (clubId: string) =>
  apiFetch<ClubReleaseResult>("/api/club/release", { method: "POST", body: { clubId } });

// ── Task 25: admin lifecycle/calendar + VPN exception tools ─────

export interface SeasonAnchorInfo {
  epochUtc: string; // ISO of the current world anchor (game day 1 starts here)
  epochDate: string; // YYYY-MM-DD (UTC) for date inputs
  gameDay: number;
  season: { id: string; number: number; startEpochDay: number; state: string } | null;
  hasSeasons: boolean;
}
export const fetchSeasonAnchor = () => apiFetch<SeasonAnchorInfo>("/api/admin/season-start");
export const fetchSetSeasonAnchor = (date: string, force = false) =>
  apiFetch<SeasonAnchorInfo>("/api/admin/season-start", { method: "POST", body: { date, force } });

export interface VpnException {
  id: string;
  value: string;
  note: string;
  createdBy: string;
  createdAt: string;
}
export const fetchVpnExceptions = () =>
  apiFetch<{ exceptions: VpnException[]; policy: string; detectUrl: string }>("/api/admin/vpn-exceptions");
export const fetchAddVpnException = (value: string, note: string) =>
  apiFetch<VpnException>("/api/admin/vpn-exceptions", { method: "POST", body: { value, note } });
export const fetchDeleteVpnException = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/admin/vpn-exceptions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
