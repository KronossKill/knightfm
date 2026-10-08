"use client";
// Knight FM — Markets hub view (Task 4-c + 9-a). Exported default consumed by the game
// shell. Tabs: Direct | Auctions | Managers | Clubs | Free Agents | Release clauses | Loans.
// Side-effect import registers the markets i18n namespace for all finance views.

import "@/lib/i18n/dict/markets";

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Handshake, Landmark } from "lucide-react";
import CinemaHeader from "@/components/game/ui/cinema-header";
import { useI18n } from "@/lib/i18n/index";
import { EnsureQueryProvider } from "./club-context";
import { DirectTab } from "./tabs/direct-tab";
import { AuctionsTab } from "./tabs/auctions-tab";
import { ManagersTab } from "./tabs/managers-tab";
import { ClubsTab } from "./tabs/clubs-tab";
import { FreeAgentsTab } from "./tabs/free-agents-tab";
import { ReleaseClausesTab } from "./tabs/release-clauses-tab";
import { LoansTab } from "./tabs/loans-tab";
import type { ClubLite } from "./types";

function MarketsHub({ club }: { club: ClubLite }) {
  const { t } = useI18n();
  return (
    <section aria-label={t("markets.title")} className="space-y-4">
      <CinemaHeader
        title={t("markets.title")}
        subtitle={t("markets.hub.subtitle")}
        image="/images/stadium-night.jpg"
        icon={Landmark}
      />

      <Tabs defaultValue="direct" className="w-full">
        <TabsList
          className="flex w-full flex-wrap gap-1 overflow-x-auto bg-muted/60 p-1 sm:flex-nowrap"
          aria-label={t("markets.title")}
        >
          <TabsTrigger value="direct" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.direct")}
          </TabsTrigger>
          <TabsTrigger value="auctions" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.auctions")}
          </TabsTrigger>
          <TabsTrigger value="managers" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.tab.managers")}
          </TabsTrigger>
          <TabsTrigger value="clubs" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.clubs")}
          </TabsTrigger>
          <TabsTrigger value="free-agents" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.freeAgents")}
          </TabsTrigger>
          <TabsTrigger value="release-clauses" className="min-h-11 flex-1 px-3 sm:flex-none">
            {t("markets.releaseClauses")}
          </TabsTrigger>
          <TabsTrigger value="loans" className="min-h-11 flex-1 px-3 sm:flex-none">
            <Handshake className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("markets.loan.title")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="direct" className="mt-4">
          <DirectTab club={club} />
        </TabsContent>
        <TabsContent value="auctions" className="mt-4">
          <AuctionsTab club={club} />
        </TabsContent>
        <TabsContent value="managers" className="mt-4">
          <ManagersTab club={club} />
        </TabsContent>
        <TabsContent value="clubs" className="mt-4">
          <ClubsTab />
        </TabsContent>
        <TabsContent value="free-agents" className="mt-4">
          <FreeAgentsTab />
        </TabsContent>
        <TabsContent value="release-clauses" className="mt-4">
          <ReleaseClausesTab club={club} />
        </TabsContent>
        <TabsContent value="loans" className="mt-4">
          <LoansTab />
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** MarketsView — exported shell contract: ({club}: {club: ClubLite}). */
export default function MarketsView({ club }: { club: ClubLite }) {
  return (
    <EnsureQueryProvider>
      <MarketsHub club={club} />
    </EnsureQueryProvider>
  );
}
