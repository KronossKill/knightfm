"use client";
// Knight FM — client auth store (Task 2-a, D-003).
// Zustand store + typed apiFetch. Tokens live in sessionStorage ONLY
// (key: knightfm.auth) — never localStorage, never cookies (XSS-scope limited).
// apiFetch attaches the Bearer token, unwraps {ok,data}|{ok,error} and, on 401
// with a refresh token present, attempts exactly ONE rotation then retries.

import { create } from "zustand";

// ─── Types ────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  path: "MANAGER" | "OWNER" | null;
  locale: string;
  theme: string;
  emailVerified?: boolean;
  walletBalance: number;
  ownedClubIds: string[];
  managedClubId: string | null;
}

export type AuthStatus = "loading" | "anon" | "authed";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: AuthStatus;
  init: () => Promise<void>;
  login: (email: string, password: string, captchaToken: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  setUser: (user: AuthUser | null) => void;
  clear: () => void;
}

export class ApiError extends Error {
  code: string;
  status: number;
  extra: Record<string, unknown>;
  constructor(code: string, message: string, status: number, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

// ─── Token persistence (sessionStorage only) ──────────────────────

const STORAGE_KEY = "knightfm.auth";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

function readTokens(): StoredTokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTokens>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
  } catch {}
}

function clearTokens() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}

// ─── apiFetch ─────────────────────────────────────────────────────

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** JSON body (automatically serialized). */
  body?: unknown;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string } & Record<string, unknown>;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Single-flight refresh so concurrent 401s don't burn the rotating token. */
function refreshSingleFlight(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = useAuth
      .getState()
      .refresh()
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * Typed fetch for Knight FM APIs. Adds `Authorization: Bearer` when a session
 * exists, parses the {ok,data}|{ok,error} envelope and throws typed ApiError.
 * On 401 (with a refresh token in sessionStorage) it attempts ONE token refresh
 * then retries the original request once; a failed refresh clears auth state.
 */
export async function apiFetch<T = unknown>(path: string, opts: ApiFetchOptions = {}): Promise<T> {
  const run = async (token: string | null): Promise<{ data: T }> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((opts.headers as Record<string, string>) ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, {
      ...opts,
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
    let json: ApiEnvelope<T> | null = null;
    try {
      json = (await res.json()) as ApiEnvelope<T>;
    } catch {
      throw new ApiError("BAD_RESPONSE", "Invalid server response", res.status);
    }
    if (!json || typeof json.ok !== "boolean") {
      throw new ApiError("BAD_RESPONSE", "Invalid server response", res.status);
    }
    if (!json.ok) {
      const err = json.error ?? { code: "UNKNOWN", message: "Unknown error" };
      const { code, message, ...rest } = err;
      throw new ApiError(code, message, res.status, rest);
    }
    return { data: json.data as T };
  };

  const stored = readTokens();
  try {
    const first = await run(stored?.accessToken ?? null);
    return first.data;
  } catch (e) {
    // Task 41 (anti-multicuenta): a BLOCKED account (multi-account IP rule or
    // admin manual block) has every session revoked server-side. Drop the local
    // tokens immediately so the UI returns to the sign-in screen, where the
    // honest "account blocked" message is shown — no refresh dance, no
    // half-alive UI polling with dead credentials.
    if (e instanceof ApiError && e.code === "ACCOUNT_BLOCKED") {
      useAuth.getState().clear();
      throw e;
    }
    const isAuthCall = path.startsWith("/api/auth/refresh") || path.startsWith("/api/auth/logout");
    const canRefresh =
      e instanceof ApiError && e.status === 401 && !!stored?.refreshToken && !isAuthCall;
    if (!canRefresh) throw e;

    const refreshed = await refreshSingleFlight();
    if (!refreshed) {
      useAuth.getState().clear();
      throw e;
    }
    const retryTokens = readTokens();
    const retry = await run(retryTokens?.accessToken ?? null);
    return retry.data;
  }
}

// ─── Store ────────────────────────────────────────────────────────

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  status: "loading",

  /** Bootstrap: restore session from sessionStorage, rotate tokens, hydrate profile. */
  init: async () => {
    const stored = readTokens();
    if (!stored) {
      set({ user: null, accessToken: null, refreshToken: null, status: "anon" });
      return;
    }
    set({ accessToken: stored.accessToken, refreshToken: stored.refreshToken });
    const okRefresh = await get().refresh();
    if (!okRefresh) {
      get().clear();
      return;
    }
    try {
      const me = await apiFetch<AuthUser>("/api/auth/me");
      set({ user: me, status: "authed" });
    } catch {
      get().clear();
    }
  },

  login: async (email, password, captchaToken) => {
    const res = await apiFetch<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password, captchaToken },
    });
    writeTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
    set({
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      status: "authed",
    });
    return res.user;
  },

  logout: async () => {
    const stored = readTokens();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: stored?.refreshToken }),
      });
    } catch {
      // Local sign-out must succeed even if the call fails.
    }
    get().clear();
  },

  /** Rotates tokens; returns false when the session cannot be restored. */
  refresh: async () => {
    const stored = readTokens();
    if (!stored?.refreshToken) return false;
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: stored.refreshToken }),
        cache: "no-store",
      });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
      if (!json.ok || !json.data) return false;
      writeTokens({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
      set({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
      return true;
    } catch {
      return false;
    }
  },

  setUser: (user) => set({ user, status: user ? "authed" : "anon" }),

  clear: () => {
    clearTokens();
    set({ user: null, accessToken: null, refreshToken: null, status: "anon" });
  },
}));
