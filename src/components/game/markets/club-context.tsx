"use client";
// Knight FM — markets club context (Task 4-c).
// - EnsureQueryProvider: defensive TanStack Query provider. Views render fine both
//   standalone (no provider above) and inside the shell (provider already present):
//   a probe component calls useQueryClient(); when it throws, the error boundary
//   re-renders children under a local QueryClientProvider.
// - useOwnedClubs: acting clubs of the session user via GET /api/club/mine, from one
//   shared query — `ownedClubs` (role OWNER) and `managedClubs` (role MANAGER, i.e. the
//   club the user currently trains; relevant for manager buy-own / resign flows).
// - useMarketError: honest ApiError → i18n message mapper shared by all market flows.

import React, { useCallback, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/components/auth/store";
import { useI18n } from "@/lib/i18n/index";

// ─── Defensive QueryClientProvider ────────────────────────────────

class QueryProbeBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function QueryProbe({ children }: { children: React.ReactNode }) {
  useQueryClient();
  return <>{children}</>;
}

/** Guarantees a QueryClientProvider exists above children (single shared fallback client). */
export function EnsureQueryProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
        },
      }),
    []
  );
  return (
    <QueryProbeBoundary
      fallback={<QueryClientProvider client={client}>{children}</QueryClientProvider>}
    >
      <QueryProbe>{children}</QueryProbe>
    </QueryProbeBoundary>
  );
}

// ─── Owned + managed clubs (acting clubs for buy/sign/bid/offer flows) ──

export interface OwnedClub {
  id: string;
  name: string;
  operatingFund: number;
  regionId: string;
  /** Secondary market: current asking price when listed (null = not for sale). */
  salePrice: number | null;
  /** Game day when the current listing was published. */
  saleListedDay: number | null;
  divisionIndex: number;
  regionNameKey: string;
  brand: { primaryColor: string; secondaryColor: string; initials: string } | null;
}

/** Club the session user manages (role MANAGER) — same shape as OwnedClub. */
export type ManagedClub = OwnedClub;

interface ClubMineClub {
  id: string;
  name: string;
  role: "OWNER" | "MANAGER";
  operatingFund: number;
  regionId: string;
  finState: string;
  salePrice: number | null;
  saleListedDay: number | null;
  divisionIndex: number;
  regionNameKey: string;
  brand: { primaryColor: string; secondaryColor: string; initials: string } | null;
}

/**
 * Acting clubs derived from one GET /api/club/mine query. `managedClubs` was added on
 * top of `ownedClubs` (Task 3-c), so existing consumers keep working unchanged.
 */
export function useOwnedClubs() {
  const query = useQuery({
    queryKey: ["markets", "owned-clubs"],
    queryFn: async (): Promise<{ owned: OwnedClub[]; managed: ManagedClub[] }> => {
      const data = await apiFetch<{ clubs: ClubMineClub[] }>("/api/club/mine");
      const clubs = data.clubs ?? [];
      const pick = (c: ClubMineClub): OwnedClub => ({
        id: c.id,
        name: c.name,
        operatingFund: c.operatingFund,
        regionId: c.regionId,
        salePrice: c.salePrice ?? null,
        saleListedDay: c.saleListedDay ?? null,
        divisionIndex: c.divisionIndex,
        regionNameKey: c.regionNameKey,
        brand: c.brand ?? null,
      });
      return {
        owned: clubs.filter((c) => c.role === "OWNER").map(pick),
        managed: clubs.filter((c) => c.role === "MANAGER").map(pick),
      };
    },
    staleTime: 30_000,
  });
  return {
    ownedClubs: query.data?.owned ?? [],
    managedClubs: query.data?.managed ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

// ─── Honest error mapping (ApiError codes → i18n) ─────────────────

const ERROR_KEY_BY_CODE: Record<string, string> = {
  BELOW_FLOOR: "markets.err.belowFloor",
  INSUFFICIENT_FUNDS: "markets.err.insufficientFunds",
  INSUFFICIENT_CLUB_FUNDS: "markets.err.insufficientFunds",
  INSUFFICIENT_PERSONAL_FUNDS: "markets.err.insufficientFunds",
  CAPACITY_FULL: "markets.err.capacityFull",
  OWN_CLUB: "markets.err.ownClub",
  OWN_AUCTION: "markets.err.ownClub",
  NOT_CLUB_OWNER: "markets.err.notClubOwner",
  CLUB_REQUIRED: "markets.err.clubRequired",
  ACTIVE_CONTRACT: "markets.err.activeContract",
  MANAGER_PATH_REQUIRED: "markets.err.managerPathRequired",
  EMAIL_NOT_VERIFIED: "markets.err.emailNotVerified",
  OFFER_TOO_LOW: "markets.err.offerTooLow",
  BID_TOO_LOW: "markets.err.bidTooLow",
  OWNER_CLUB_LIMIT: "markets.err.ownerClubLimit",
  OWNER_LIMIT: "markets.err.ownerClubLimit",
  OWNER_REGION_LIMIT: "markets.err.ownerRegionLimit",
  CLUB_TAKEN: "markets.err.clubTaken",
  CLUB_UNAVAILABLE: "markets.err.clubTaken",
  CLUB_NOT_FOR_SALE: "markets.err.clubNotForSale",
  OWN_CLUB_PURCHASE: "markets.err.ownClubPurchase",
  PRICE_OUT_OF_RANGE: "markets.err.priceOutOfRange",
  NOT_OWNER: "markets.err.notOwner",
  DEBT_BLOCK: "markets.err.debtBlock",
  RATE_LIMITED: "markets.err.rateLimited",
  CAPTCHA_INVALID: "markets.err.captchaInvalid",
  ALREADY_LISTED: "markets.direct.alreadyListed",
  LISTING_NOT_OPEN: "markets.direct.listingClosed",
  AUCTION_CLOSED: "markets.direct.listingClosed",
  NOT_FREE_AGENT: "markets.freeAgents.notFreeAgent",
  DEPOSIT_UNAVAILABLE: "markets.wallet.depositUnavailable",
  WITHDRAWAL_UNAVAILABLE: "markets.wallet.withdrawUnavailable",
  BELOW_MIN_WITHDRAW: "markets.err.belowMinWithdraw",
  DUPLICATE_DEPOSIT: "markets.wallet.depositDuplicate",
  RECIPIENT_NOT_FOUND: "markets.inbox.recipientNotFound",
  CANNOT_SELF_MESSAGE: "markets.inbox.selfMessage",
  LOCKED_KEY: "markets.cc.configLocked",
  INVALID_TOKEN: "markets.cc.resetInvalidToken",
  TOKEN_EXPIRED: "markets.cc.resetTokenExpired",
  FORBIDDEN: "markets.cc.forbidden",
};

export interface MarketErrorInfo {
  /** Primary i18n message for the error. */
  message: string;
  /** Raw server message, when available (always shown for honesty). */
  serverMessage: string | null;
  /** Server-provided extra payload (floor, minAccepted, minWithdraw, reason, …). */
  extra: Record<string, unknown>;
  code: string;
  status: number;
}

/**
 * Builds an honest, localized description of any thrown error.
 * The raw server message is always surfaced alongside the i18n text.
 */
export function describeMarketError(t: (k: string, v?: Record<string, string | number>) => string, e: unknown): MarketErrorInfo {
  if (e instanceof ApiError) {
    const key = ERROR_KEY_BY_CODE[e.code];
    let message = key ? t(key) : t("markets.err.generic");
    const extra = e.extra ?? {};
    // Numeric hints embedded by the API (BELOW_FLOOR.floor, BID_TOO_LOW.minAccepted, …).
    if (e.code === "BELOW_FLOOR" && typeof extra.floor === "number") {
      message = t("markets.err.belowFloor", { floor: extra.floor });
    }
    if (e.code === "BID_TOO_LOW" && typeof extra.minAccepted === "number") {
      message = t("markets.err.bidTooLow", { min: extra.minAccepted });
    }
    if (e.code === "BELOW_MIN_WITHDRAW" && typeof extra.minWithdraw === "number") {
      message = t("markets.err.belowMinWithdraw", { min: extra.minWithdraw });
    }
    if (e.code === "OFFER_TOO_LOW" && typeof extra.durationDays === "number") {
      message = t("markets.err.offerTooLow", { min: extra.durationDays });
    }
    if (e.code === "OWNER_REGION_LIMIT") {
      message = t("markets.err.ownerRegionLimit");
    }
    if (e.code === "OUT_OF_RANGE") {
      const min = typeof extra.minValue === "number" ? t("markets.cc.valueMin", { min: extra.minValue }) : "";
      const max = typeof extra.maxValue === "number" ? t("markets.cc.valueMax", { max: extra.maxValue }) : "";
      message = [min, max].filter(Boolean).join(" · ") || e.message;
    }
    return {
      message,
      serverMessage: e.message || null,
      extra,
      code: e.code,
      status: e.status,
    };
  }
  return {
    message: t("markets.err.generic"),
    serverMessage: e instanceof Error ? e.message : null,
    extra: {},
    code: "UNKNOWN",
    status: 0,
  };
}

/** React hook wrapper around describeMarketError bound to i18n. */
export function useMarketError() {
  const { t } = useI18n();
  return React.useCallback((e: unknown) => describeMarketError(t, e), [t]);
}

// ─── Effect-free auto selection (lint: react-hooks/set-state-in-effect) ──

/**
 * Derived selection with a manual override scoped to a session key.
 * While `auto` (or the session key) does not change, the manual value applies;
 * when the dialog re-opens for another target the value falls back to `auto`.
 * Deliberately effect-free (no setState inside useEffect/render).
 */
export function useAutoSelection<T>(auto: T, sessionKey: string): [T, (v: T) => void] {
  const [manual, setManual] = useState<{ key: string; value: T } | null>(null);
  const value = manual && manual.key === sessionKey ? manual.value : auto;
  const set = useCallback((v: T) => setManual({ key: sessionKey, value: v }), [sessionKey]);
  return [value, set];
}
