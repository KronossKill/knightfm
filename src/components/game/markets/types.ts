"use client";
// Knight FM — markets shared types (Task 4-c). Mirrors the API response shapes
// of /api/markets/**, /api/treasury, /api/wallet, /api/messages, /api/admin/**.
// Public player projection comes from playerCard() in src/app/api/_lib/markets-lib.ts.

export interface ClubLite {
  id: string;
  name: string;
  role: "OWNER" | "MANAGER";
}

/** Public player projection (matches server playerCard). */
export interface PlayerCardData {
  id: string;
  name: string;
  position: string;
  ovr: number;
  stars: number;
  age: number;
  marketValue: number;
}

export interface DirectListing {
  listingId: string;
  player: PlayerCardData | null;
  price: number;
  floor: number;
  sellerClub: { id: string; name: string } | null;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
}

export interface AuctionItem {
  listingId: string;
  player: PlayerCardData | null;
  startPrice: number;
  floor: number;
  currentHighest: number | null;
  leaderClubId: string | null;
  bidCount: number;
  sellerClub: { id: string; name: string } | null;
  expiresAt: string;
  createdAt: string;
}

export interface ManagerOfferItem {
  id: string;
  club: {
    id: string;
    name: string;
    regionId: string;
    regionNameKey: string;
    systemOwned: boolean;
  };
  seasons: number;
  contract: { totalAmount: number; durationDays: number; dailySalary: number };
  state: string;
  createdAt: string;
  expiresAt: string;
}

export interface SystemClubItem {
  id: string;
  name: string;
  brand: { primaryColor: string; secondaryColor: string; badgeShape: string; initials: string } | null;
  regionIndex: number;
  regionNameKey: string;
  divisionIndex: number;
  squadSize: number;
  avgOvr: number | null;
  facilitiesCount: number;
  operatingFund: number;
  price: number | null;
}

/** GET /api/markets/clubs/sale — a club listed for resale by another owner. */
export interface OwnerClubListing {
  clubId: string;
  name: string;
  brand: { primaryColor: string; secondaryColor: string; badgeShape: string; initials: string } | null;
  regionIndex: number;
  regionNameKey: string;
  divisionIndex: number;
  squadSize: number;
  avgOvr: number | null;
  facilitiesCount: number;
  operatingFund: number;
  /** Asking price set freely by the seller owner. */
  salePrice: number;
  saleListedDay: number | null;
  hasManager: boolean;
  sellerUsername: string | null;
}

/** Open LOAN listing row from GET /api/markets/loans (Task 9-a). */
export interface LoanListing {
  id: string;
  price: number;
  durationDays: number;
  createdAt: string;
  player: PlayerCardData | null;
  originClub: { id: string; name: string } | null;
}

/** Squad view from GET /api/players?clubId= (staff). */
export interface SquadPlayer {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  position: string;
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
  /** Task 9-a: OUT = away at the borrowing club · IN = borrowed from another club. */
  loan?: { status: "OUT" | "IN"; untilDay: number } | null;
}

/** GET /api/players/[id] — public vs staff views. */
export interface PublicPlayerView {
  view: "PUBLIC";
  player: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    ovr: number;
    stars: number;
    age: number;
  };
}

export interface StaffPlayerView {
  view: "STAFF";
  player: {
    id: string;
    clubId: string | null;
    firstName: string;
    lastName: string;
    age: number;
    position: string;
    detailedPos: string;
    ovr: number;
    potential: number;
    stars: number;
    marketValue: number;
    salary: number;
    releaseClause: number;
    state: {
      form: number;
      fatigue: number;
      sharpness: number;
      morale: number;
      confidence: number;
      injuredUntil: string | null;
      suspension: number;
      isFreeAgent: boolean;
      isYouth: boolean;
      retired: boolean;
    };
    /** Task 9-a: present while the player is registered on loan at another club. */
    loan?: { untilDay: number; originClubId: string | null } | null;
  };
}

export type PlayerProfileResponse = PublicPlayerView | StaffPlayerView;

export interface TreasuryState {
  clubId: string;
  operatingFund: number;
  debt: number;
  finState: string;
  unpaidDays: number;
  /** Task 23-b: tax percentage withheld on club→owner withdrawals. */
  withdrawTaxPct: number;
  /** Task 25-b: gravamen on club income (prizes, sales, match revenue, loans) → SYSTEM fund. */
  incomeTaxPct: number;
  ledger: LedgerRow[];
}

export interface LedgerRow {
  id: string;
  category: string;
  amount: number;
  balanceAfter: number;
  memo: string;
  createdAt: string;
  grossAmount?: number | null;
  levyAmount?: number | null;
  netAmount?: number | null;
}

export interface WalletState {
  balance: number;
  ledger: LedgerRow[];
  depositAddressConfigured: boolean;
  /** Task 57: public deposit destination (system wallet) — null when unset/invalid. */
  depositAddress: string | null;
  /** $Knight SPL mint (mainnet, public). */
  mint: string | null;
  /** Solana Pay transfer-request URI encoded in the deposit QR. */
  solanaPayUri: string | null;
  priceAvailable: boolean;
  /** Admin-configured minimum for Solana withdrawals ($Knight, server-enforced). */
  minWithdraw: number;
}

export type WalletPrice =
  | { available: false; reason: string }
  | { available: true; price: number; priceX1000: number; source: string; capturedAt: string };

export type DepositResult =
  | { status: "PENDING"; gross: 0; levy: 0; net: 0; note: string; reason?: string }
  | { status: "CREDITED"; gross: number; levy: number; net: number; note: string };

export interface MessageThread {
  userId: string;
  lastBody: string;
  lastAt: string;
  total: number;
  unread: number;
  username: string | null;
}

export interface NotificationItem {
  id: string;
  typeKey: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface AdminConfigRow {
  key: string;
  group: string;
  valueType: "int" | "string" | "bool" | "json";
  defaultValue: string;
  currentValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  locked: boolean;
  description: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface JobRunItem {
  id: string;
  idempotencyKey: string;
  jobType: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  outcome: string;
  retryCount: number;
  error: string | null;
}

export interface AuditItem {
  id: string;
  type: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsData {
  windowDays: number;
  total: number;
  byName: Array<{ name: string; count: number }>;
  funnel: Array<{ step: string; count: number }>;
}

export interface AssistantHistoryItem {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
  screen: string | null;
  createdAt: string;
}
