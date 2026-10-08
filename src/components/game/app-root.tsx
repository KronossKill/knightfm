"use client";
// Knight FM — AppRoot (Task 4-a): the app composition root that page.tsx renders.
//
// Flow:
//   status "loading" → splash (session bootstrap)
//   status "anon"    → Landing (until the visitor taps a CTA) → AuthFlow
//   status "authed"  → onboarding gate:
//        /api/onboarding/state shows needsPath or no club → OnboardingFlow
//        otherwise → GameShell
//
// Also mounts the TanStack QueryClient for the whole game and registers the
// `game` i18n namespace (side-effect import).

import "@/lib/i18n/dict/game";

import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/store";
import { KnightLogo } from "@/components/knight-logo";
import { KnightUsdSync } from "@/components/knight-usd-sync";
import { useI18n } from "@/lib/i18n";
import { useViewStore } from "@/components/game/view-store";
import Landing from "@/components/landing";
import AuthFlow from "@/components/auth/AuthFlow";
import OnboardingFlow from "@/components/onboarding/onboarding-flow";
import GameShell from "@/components/game/shell";
import { fetchOnboardingState, qk } from "@/components/game/api";

// ── Splash ──────────────────────────────────────────────────────

function Splash() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background" role="status" aria-live="polite">
      <KnightLogo size={64} priority />
      <span className="sr-only">Knight FM</span>
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
      <span className="text-xs text-muted-foreground">{t("game.shell.loading")}</span>
    </div>
  );
}

// ── Authenticated gate: onboarding vs. game shell ───────────────

function AuthedGate() {
  const { t } = useI18n();
  const { user } = useAuth();
  // Reactive zustand flag (initialized from sessionStorage, so it also survives
  // reloads): a plain query invalidation cannot trigger the onboarding→shell
  // switch because structural sharing keeps the same data reference for
  // identical /api/onboarding/state payloads. Hooks must run unconditionally,
  // BEFORE the early returns below.
  const depositEscape = useViewStore((s) => s.depositEscape);
  const stateQ = useQuery({
    queryKey: qk.onboardingState,
    queryFn: fetchOnboardingState,
    staleTime: 0,
  });

  if (stateQ.isLoading) return <Splash />;

  if (stateQ.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4" role="alert">
        <p className="text-sm text-muted-foreground">{t("err.generic")}</p>
        <button
          type="button"
          className="min-h-11 rounded-md border border-primary/40 px-4 text-sm text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => void stateQ.refetch()}
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  const s = stateQ.data;
  // EVERY user — admins included — must decide their career path (MANAGER/OWNER)
  // and get a club before any game view is shown (user mandate: "cuando un usuario
  // no tiene club asignado, no se le muestra ninguna vista hasta que haya decidido
  // qué hará"). Admins get an explicit escape hatch inside OnboardingFlow
  // ("Control Center only"), stored in sessionStorage so the shell can restrict
  // itself to the Control Center until they join a club. There is also a DEPOSIT
  // escape hatch ("Fondos insuficientes" dialog → "Ir a depositar ahora"): the
  // shell restricts itself to the Wallet so the user can fund their account with
  // a verified Solana deposit, then returns to the onboarding decision.
  const adminCcOnly =
    typeof window !== "undefined" &&
    user?.role === "ADMIN" &&
    window.sessionStorage.getItem("kfm.admin.ccOnly") === "1";
  const needsOnboarding =
    !adminCcOnly && !depositEscape && (!s || s.needsPath || (!s.hasManagedClub && !s.hasOwnedClub));
  return needsOnboarding ? <OnboardingFlow onDone={() => undefined} /> : <GameShell />;
}

// ── Root ────────────────────────────────────────────────────────

export default function AppRoot() {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 },
        },
      })
  );
  const status = useAuth((s) => s.status);
  const [view, setView] = React.useState<"landing" | "auth">("landing");

  // Bootstrap session restore exactly once (nothing else calls init).
  const initStarted = React.useRef(false);
  React.useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;
    void useAuth.getState().init();
  }, []);

  // After logout we return to the landing page.
  React.useEffect(() => {
    if (status === "anon") setView("landing");
  }, [status]);

  let content: React.ReactNode;
  if (status === "loading") {
    content = <Splash />;
  } else if (status === "anon") {
    content =
      view === "landing" ? (
        <Landing onPrimaryCta={() => setView("auth")} onSecondaryCta={() => setView("auth")} />
      ) : (
        <AuthFlow />
      );
  } else {
    content = <AuthedGate />;
  }

  return <QueryClientProvider client={queryClient}><KnightUsdSync />{content}</QueryClientProvider>;
}
