"use client";
// Knight FM — module loader (lead integration).
// All game modules exist now, so we use static next/dynamic imports
// (Turbopack cannot resolve fully-dynamic `import()` specifiers).
// Markets/Treasury require the active club; ClubGate provides it from
// moduleProps or falls back to the ACTIVE club (view-store, Task 23-e).

import * as React from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/game/ui/bits";
import { useActiveClub } from "@/components/game/hooks/use-active-club";

const loadingFallback = () => <LoadingBlock />;

function LoadingBlock() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border bg-card/50" role="status" aria-live="polite">
      <Loader2 aria-hidden="true" className="size-6 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
    </div>
  );
}

const TacticsView = dynamic(() => import("@/components/game/tactics/tactics-view"), { ssr: false, loading: loadingFallback });
const MarketsView = dynamic(() => import("@/components/game/markets/markets-view"), { ssr: false, loading: loadingFallback });
const TreasuryView = dynamic(() => import("@/components/game/treasury/treasury-view"), { ssr: false, loading: loadingFallback });
const InboxView = dynamic(() => import("@/components/game/inbox/inbox-view"), { ssr: false, loading: loadingFallback });
const WalletView = dynamic(() => import("@/components/game/wallet/wallet-view"), { ssr: false, loading: loadingFallback });
const AssistantPanel = dynamic(() => import("@/components/game/assistant/assistant-panel"), { ssr: false, loading: loadingFallback });
const ControlCenterView = dynamic(() => import("@/components/game/control-center/control-center-view"), { ssr: false, loading: loadingFallback });

export type LazyModuleKey =
  | "tactics"
  | "markets"
  | "treasury"
  | "wallet"
  | "inbox"
  | "assistant-panel"
  | "control-center";

export interface ClubLiteProp {
  id: string;
  name: string;
  role: "OWNER" | "MANAGER";
}

interface ModuleSlotProps {
  moduleKey: LazyModuleKey;
  moduleProps?: Record<string, unknown>;
  className?: string;
}

/** Provides the active club to club-dependent modules: prop first, then view-store/active-club resolution. */
function ClubGate({ club, children }: { club?: ClubLiteProp; children: (c: ClubLiteProp) => React.ReactNode }) {
  // Task 23-e: the fallback resolves the ACTIVE club (top-bar switcher), never
  // blindly clubs[0] — every club stays fully independent.
  const { club: activeClub, isLoading } = useActiveClub();

  if (club) return <>{children(club)}</>;
  if (isLoading) return <LoadingBlock />;
  const first = activeClub;
  if (!first) {
    return (
      <EmptyState
        title="Sin club"
        hint="No se pudo determinar tu club activo."
      />
    );
  }
  return <>{children(first)}</>;
}

export function ModuleSlot({ moduleKey, moduleProps, className }: ModuleSlotProps) {
  const propClub = moduleProps?.club as ClubLiteProp | undefined;

  switch (moduleKey) {
    case "tactics":
      return (
        <div className={className}>
          <TacticsView club={propClub} />
        </div>
      );
    case "markets":
      return (
        <div className={className}>
          <ClubGate club={propClub}>{(c) => <MarketsView club={c} />}</ClubGate>
        </div>
      );
    case "treasury":
      return (
        <div className={className}>
          <ClubGate club={propClub}>{(c) => <TreasuryView club={c} />}</ClubGate>
        </div>
      );
    case "wallet":
      return (
        <div className={className}>
          <WalletView />
        </div>
      );
    case "inbox":
      return (
        <div className={className}>
          <InboxView />
        </div>
      );
    case "assistant-panel":
      return (
        <div className={className}>
          <AssistantPanel screen={moduleProps?.screen as string | undefined} />
        </div>
      );
    case "control-center":
      return (
        <div className={className}>
          <ControlCenterView />
        </div>
      );
    default:
      return null;
  }
}

export function AssistantPanelSlot({ className }: { className?: string }) {
  return <ModuleSlot moduleKey="assistant-panel" className={className} />;
}
