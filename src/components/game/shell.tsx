"use client";
// Knight FM — GameShell (Task 4-a): the authenticated app.
// Top bar (club identity, world clock, presence, inbox, user menu), floating
// assistant FAB, responsive sidebar (drawer < lg), active view area and footer.
// Polling: world state 60s, presence 60s, notifications 60s, heartbeat 60s.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Bot,
  Building2,
  CalendarDays,
  ChevronDown,
  Construction,
  Dumbbell,
  FlaskConical,
  Gem,
  Globe2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MonitorCog,
  Settings as SettingsIcon,
  Shield,
  Shirt,
  Sun,
  Trophy,
  Users,
  UsersRound,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnightLogo } from "@/components/knight-logo";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES } from "@/components/theme-provider";
import { LANGUAGES, type Language, type ThemeId } from "@/lib/themes";
import { useAuth } from "@/components/auth/store";
import { useViewStore, type GameView } from "@/components/game/view-store";
import { fetchMyClubs, fetchPresence, fetchWorldState, fetchNotifications, qk, type ClubMine } from "@/components/game/api";
import { useHeartbeat } from "@/hooks/use-heartbeat";
import { AssistantPanelSlot, ModuleSlot } from "@/components/game/lazy-modules";
import { BrandBadge, formatUtcClock, useNow } from "@/components/game/ui/bits";
import { CountryFlag } from "@/components/game/ui/country-flag";
// Task 73: restore the connection-country flag next to the username (the
// Task 53 component existed but nothing rendered it after the UX redesign).
import { CountryFlag as ConnectionCountryFlag } from "@/components/game/country-flag";
import DashboardView from "@/components/game/dashboard/dashboard-view";
import SquadView from "@/components/game/squad/squad-view";
import CompetitionsView from "@/components/game/competitions/competitions-view";
import TrainingView from "@/components/game/training/training-view";
import FacilitiesView from "@/components/game/facilities/facilities-view";
import StaffView from "@/components/game/staff/staff-view";
import YouthView from "@/components/game/youth/youth-view";
import SettingsView from "@/components/game/settings/settings-view";

// ── Navigation model ────────────────────────────────────────────

interface NavItem {
  view: GameView;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const NAV_MAIN: NavItem[] = [
  { view: "dashboard", labelKey: "game.nav.dashboard", icon: LayoutDashboard },
  { view: "squad", labelKey: "game.nav.squad", icon: Users },
  { view: "tactics", labelKey: "game.nav.tactics", icon: Shirt },
  { view: "training", labelKey: "game.nav.training", icon: Dumbbell },
  { view: "facilities", labelKey: "game.nav.facilities", icon: Building2 },
  { view: "staff", labelKey: "game.nav.staff", icon: UsersRound },
  { view: "youth", labelKey: "game.nav.youth", icon: FlaskConical },
  { view: "competitions", labelKey: "game.nav.competitions", icon: Trophy },
];

const NAV_SYSTEM: NavItem[] = [
  { view: "markets", labelKey: "game.nav.markets", icon: Landmark },
  { view: "treasury", labelKey: "game.nav.treasury", icon: Gem },
  { view: "wallet", labelKey: "game.nav.wallet", icon: WalletIcon },
  { view: "inbox", labelKey: "game.nav.inbox", icon: Mail },
  { view: "settings", labelKey: "game.nav.settings", icon: SettingsIcon },
];

const NAV_ADMIN: NavItem[] = [{ view: "control-center", labelKey: "game.nav.controlCenter", icon: MonitorCog }];

// ── World clock widget ──────────────────────────────────────────

function WorldClock({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: qk.world, queryFn: fetchWorldState, refetchInterval: 60_000 });
  const nowMs = useNow(1000);
  const hydrated = nowMs > 0;

  if (isLoading) return <Skeleton className="h-9 w-44" aria-hidden="true" />;

  const season = data?.season ?? null;
  const seasonLine = season
    ? season.preseasonDay !== undefined
      ? t("world.preseasonDay", { day: season.preseasonDay })
      : t("world.seasonDay", { day: season.seasonDay ?? 0 })
    : "";

  return (
    <div
      className="hidden items-center gap-2.5 rounded-lg border bg-card/60 px-3 py-1.5 md:flex"
      title={t("world.liveNow")}
      aria-label={`${t("world.gameDay")} ${data?.gameDay ?? ""} · ${seasonLine}`}
    >
      <Globe2 aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {hydrated ? formatUtcClock(nowMs) : "--:--:--"}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">UTC</span>
        </span>
        {!compact && (
          <span className="text-[11px] text-muted-foreground">
            {t("world.gameDay")} {data?.gameDay ?? "—"}
            {seasonLine ? ` · ${seasonLine}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Presence gadget ─────────────────────────────────────────────

function PresenceGadget({ fallbackOnline = 0 }: { fallbackOnline?: number }) {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({ queryKey: qk.presence, queryFn: fetchPresence, refetchInterval: 60_000 });
  const online = data?.online ?? fallbackOnline;
  // Task 67 (USER MANDATE): flags of the countries currently connected.
  const flags = data?.flags ?? [];
  const hidden = flags.length > 5 ? flags.length - 5 : 0;
  return (
    <div
      className="hidden items-center gap-1.5 rounded-lg border bg-card/60 px-2.5 py-2 text-xs text-muted-foreground sm:flex"
      aria-label={t("game.shell.online", { n: online })}
    >
      <span className="relative flex size-2" aria-hidden="true">
        <span className={cn("absolute inline-flex size-full rounded-full opacity-60", isLoading ? "bg-muted-foreground" : "animate-ping bg-primary")} />
        <span className={cn("relative inline-flex size-2 rounded-full", isLoading ? "bg-muted-foreground" : "bg-primary")} />
      </span>
      {t("game.shell.online", { n: isLoading ? "…" : online })}
      {flags.length > 0 && (
        <span className="ml-1 flex items-center gap-1 border-l pl-2" aria-hidden="true">
          {flags.slice(0, 5).map((f) => (
            <CountryFlag key={f.c} code={f.c} count={f.n} />
          ))}
          {hidden > 0 && <span className="text-[10px] font-medium tabular-nums">+{hidden}</span>}
        </span>
      )}
    </div>
  );
}

// ── Club identity + switcher ────────────────────────────────────

function ClubIdentity({ clubs, isLoading }: { clubs: ClubMine[]; isLoading: boolean }) {
  const { t } = useI18n();
  const activeClubId = useViewStore((s) => s.activeClubId);
  const setActiveClub = useViewStore((s) => s.setActiveClub);
  const club = clubs.find((c) => c.id === activeClubId) ?? clubs[0] ?? null;

  if (isLoading) return <Skeleton className="h-10 w-52" aria-hidden="true" />;
  if (!club) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield aria-hidden="true" className="size-5 text-muted-foreground/60" />
        <span>{t("game.dash.noClub")}</span>
      </div>
    );
  }

  const identity = (
    <>
      <BrandBadge brand={club.brand} name={club.name} />
      <div className="hidden min-w-0 flex-col leading-tight md:flex">
        <span className="truncate text-sm font-semibold">{club.name}</span>
        <span className="truncate text-[11px] text-muted-foreground">
          {t(club.regionNameKey)} · {t("game.comp.division")} {club.divisionIndex}
        </span>
      </div>
    </>
  );

  if (clubs.length <= 1) {
    return (
      <div className="flex items-center gap-2" aria-label={club.name}>
        {identity}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 gap-2 px-2"
          aria-label={`${club.name} — ${t("game.nav.club")}`}
        >
          {identity}
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("game.nav.club")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {clubs.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => setActiveClub(c.id)}
            className={cn("gap-2", c.id === club.id && "bg-primary/10")}
            aria-current={c.id === club.id}
          >
            <BrandBadge brand={c.brand} name={c.name} size="sm" />
            <span className="min-w-0 flex-1 truncate">{c.name}</span>
            <Badge variant="outline" className="text-[10px]">
              {c.role === "OWNER" ? t("role.owner") : t("role.manager")}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── User menu ───────────────────────────────────────────────────

function UserMenu({ user }: { user: { username: string; role: string; path: string | null } }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const logout = useAuth((s) => s.logout);
  const setView = useViewStore((s) => s.setView);
  const roleLabel =
    user.role === "ADMIN"
      ? t("role.admin")
      : user.path
        ? t(`game.settings.path.${user.path}`)
        : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 gap-2" aria-label={t("game.shell.userMenu")}>
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {user.username.slice(0, 2).toUpperCase()}
          </span>
          <span className="hidden max-w-28 truncate text-sm sm:inline">{user.username}</span>
          {/* Task 73: flag of the caller's own connection country. */}
          <ConnectionCountryFlag />
          {user.role === "ADMIN" && <BadgeCheck aria-hidden="true" className="size-4 text-amber-400" />}
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{user.username}</span>
            <span className="text-xs font-normal text-muted-foreground">{roleLabel}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun aria-hidden="true" className="mr-2 size-4" />
            {t("game.shell.theme")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEMES.map((th) => (
              <DropdownMenuItem
                key={th.id}
                onClick={() => setTheme(th.id as ThemeId)}
                className={cn("gap-2", theme === th.id && "bg-primary/10")}
                aria-current={theme === th.id}
              >
                <span className="flex shrink-0 -space-x-1" aria-hidden="true">
                  {th.swatch.map((c, i) => (
                    <span key={i} className="inline-block size-3.5 rounded-full border border-background" style={{ backgroundColor: c }} />
                  ))}
                </span>
                {t(th.nameKey)}
                {theme === th.id && <span className="sr-only">({t("common.yes")})</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe2 aria-hidden="true" className="mr-2 size-4" />
            {t("game.shell.language")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LANGUAGES.map((l) => (
              <DropdownMenuItem
                key={l.id}
                onClick={() => setLang(l.id as Language)}
                className={cn("gap-2", lang === l.id && "bg-primary/10")}
                aria-current={lang === l.id}
              >
                <span aria-hidden="true">{l.flag}</span>
                {l.name}
                <span className="sr-only">{l.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setView("settings")}>
          <SettingsIcon aria-hidden="true" className="mr-2 size-4" />
          {t("game.shell.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void logout()} variant="destructive">
          <LogOut aria-hidden="true" className="mr-2 size-4" />
          {t("game.shell.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Assistant dialog ────────────────────────────────────────────

function AssistantDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot aria-hidden="true" className="size-5 text-primary" />
            {t("game.shell.assistant")}
          </DialogTitle>
          <DialogDescription>{t("game.shell.assistantSoon")}</DialogDescription>
        </DialogHeader>
        <AssistantPanelSlot />
      </DialogContent>
    </Dialog>
  );
}

// ── Sidebar (desktop + mobile sheet share the item list) ────────

function NavList({ onNavigate, ccOnly = false, walletOnly = false }: { onNavigate?: () => void; ccOnly?: boolean; walletOnly?: boolean }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const view = useViewStore((s) => s.view);
  const setView = useViewStore((s) => s.setView);
  const setDepositEscape = useViewStore((s) => s.setDepositEscape);

  const renderItems = (items: NavItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = view === item.view;
      return (
        <button
          key={item.view}
          type="button"
          onClick={() => {
            setView(item.view);
            onNavigate?.();
          }}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            active
              ? "bg-primary/15 font-medium text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon aria-hidden="true" className={cn("size-4 shrink-0", active && "text-primary")} />
          <span className="truncate">{t(item.labelKey)}</span>
        </button>
      );
    });

  // Restricted modes, both chosen via an explicit escape hatch on the onboarding
  // screen (admins: "Control Center only"; everyone: "Ir a depositar ahora"):
  // no game views — the user must finish their decision/funding first.
  const groups: { labelKey: string; items: NavItem[] }[] = ccOnly
    ? [{ labelKey: "game.nav.system", items: NAV_ADMIN }]
    : walletOnly
      ? [{ labelKey: "game.nav.system", items: NAV_SYSTEM.filter((i) => i.view === "wallet") }]
      : [
          { labelKey: "game.nav.main", items: NAV_MAIN },
          { labelKey: "game.nav.system", items: NAV_SYSTEM },
          ...(user?.role === "ADMIN" ? [{ labelKey: "game.nav.system", items: NAV_ADMIN }] : []),
        ];

  return (
    <nav aria-label="Knight FM" className="flex flex-col gap-4">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-1">
          <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            {t(g.labelKey)}
          </span>
          {renderItems(g.items)}
        </div>
      ))}
      {(ccOnly || walletOnly) && (
        <Button
          variant="outline"
          className="min-h-11 w-full"
          onClick={() => {
            if (ccOnly) {
              window.sessionStorage.removeItem("kfm.admin.ccOnly");
              window.location.reload();
            } else {
              window.sessionStorage.removeItem("kfm.onb.wallet");
              setDepositEscape(false);
            }
          }}
        >
          {t("game.shell.ccOnlyChoose")}
        </Button>
      )}
    </nav>
  );
}

function Sidebar({ ccOnly = false, walletOnly = false }: { ccOnly?: boolean; walletOnly?: boolean }) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r bg-card/30 p-3 lg:block">
      <NavList ccOnly={ccOnly} walletOnly={walletOnly} />
    </aside>
  );
}

function MobileNav({ ccOnly = false, walletOnly = false }: { ccOnly?: boolean; walletOnly?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={t("game.shell.openNav")}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("game.shell.openNav")}</SheetTitle>
        </SheetHeader>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <KnightLogo size={28} eager />
            <span className="text-sm font-semibold tracking-wide text-primary">KNIGHT FM</span>
          </span>
          <Button variant="ghost" size="icon" aria-label={t("game.shell.closeNav")} onClick={() => setOpen(false)}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <Separator className="my-3" />
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto pr-1">
          <NavList onNavigate={() => setOpen(false)} ccOnly={ccOnly} walletOnly={walletOnly} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── View switch ─────────────────────────────────────────────────

/** ACTIVE club (top-bar switcher) as the lite shape required by markets/treasury modules. */
function useClubLite(): { id: string; name: string; role: "OWNER" | "MANAGER" } | undefined {
  const activeClubId = useViewStore((s) => s.activeClubId);
  const clubs = useQuery({ queryKey: qk.myClubs, queryFn: fetchMyClubs, staleTime: 30_000 }).data?.clubs ?? [];
  const c = clubs.find((x) => x.id === activeClubId) ?? clubs[0];
  return c ? { id: c.id, name: c.name, role: c.role } : undefined;
}

function ActiveView({ clubs }: { clubs: ClubMine[] }) {
  const view = useViewStore((s) => s.view);
  const clubLite = useClubLite();
  switch (view) {
    case "dashboard":
      return <DashboardView clubs={clubs} />;
    case "squad":
      return <SquadView />;
    case "tactics":
      return <ModuleSlot moduleKey="tactics" className="mx-auto max-w-6xl" moduleProps={{ club: clubLite }} />;
    case "training":
      return <TrainingView />;
    case "facilities":
      return <FacilitiesView />;
    case "staff":
      return <StaffView />;
    case "youth":
      return <YouthView />;
    case "competitions":
      return <CompetitionsView />;
    case "markets":
      return <ModuleSlot moduleKey="markets" className="mx-auto max-w-6xl" moduleProps={{ club: clubLite }} />;
    case "treasury":
      return <ModuleSlot moduleKey="treasury" className="mx-auto max-w-6xl" moduleProps={{ club: clubLite }} />;
    case "wallet":
      return <ModuleSlot moduleKey="wallet" className="mx-auto max-w-6xl" />;
    case "inbox":
      return <ModuleSlot moduleKey="inbox" className="mx-auto max-w-3xl" />;
    case "assistant":
      return (
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Bot aria-hidden="true" className="size-5 text-primary" />
            <AssistantTitle />
          </h1>
          <AssistantPanelSlot />
        </div>
      );
    case "settings":
      return <SettingsView />;
    case "control-center":
      return <ModuleSlot moduleKey="control-center" className="mx-auto max-w-6xl" />;
    default:
      return <DashboardView clubs={clubs} />;
  }
}

function AssistantTitle() {
  const { t } = useI18n();
  return <>{t("game.shell.assistant")}</>;
}

// ── GameShell ───────────────────────────────────────────────────

export default function GameShell() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nowMs = useNow(1000);
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const setView = useViewStore((s) => s.setView);
  const setActiveClub = useViewStore((s) => s.setActiveClub);

  const clubsQuery = useQuery({ queryKey: qk.myClubs, queryFn: fetchMyClubs, refetchInterval: 120_000 });
  const clubs = clubsQuery.data?.clubs ?? [];
  const depositEscape = useViewStore((s) => s.depositEscape);
  const setDepositEscape = useViewStore((s) => s.setDepositEscape);
  // Deposit escape hatch ("Fondos insuficientes" dialog → "Ir a depositar ahora"):
  // club-less user who needs to fund their personal wallet with a verified Solana
  // deposit. The shell restricts itself to the Wallet until they return to the
  // onboarding decision ("Elegir camino / club"). Takes PRECEDENCE over the
  // admin "Control Center only" mode — the user's last explicit intent wins.
  const walletOnly = depositEscape && clubs.length === 0;
  // Club-less ADMIN in "Control Center only" mode (explicit escape hatch chosen
  // on the onboarding screen): nav is restricted to the Control Center and the
  // game views stay locked until the user decides path + club.
  const ccOnly = user?.role === "ADMIN" && !walletOnly && !clubsQuery.isLoading && clubs.length === 0;
  const worldQuery = useQuery({ queryKey: qk.world, queryFn: fetchWorldState, refetchInterval: 60_000 });
  const notificationsQuery = useQuery({
    queryKey: qk.notifications,
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
  });
  const unread = notificationsQuery.data?.unread ?? 0;

  // Keep the active club valid when the club list changes.
  React.useEffect(() => {
    if (clubs.length === 0) {
      if (useViewStore.getState().activeClubId !== null) setActiveClub(null);
      return;
    }
    // A club exists again: the escape-hatch restrictions are no longer needed.
    if (user?.role === "ADMIN" && window.sessionStorage.getItem("kfm.admin.ccOnly") === "1") {
      window.sessionStorage.removeItem("kfm.admin.ccOnly");
    }
    if (window.sessionStorage.getItem("kfm.onb.wallet") === "1") {
      window.sessionStorage.removeItem("kfm.onb.wallet");
      useViewStore.getState().setDepositEscape(false);
    }
    const current = useViewStore.getState().activeClubId;
    if (!current || !clubs.some((c) => c.id === current)) setActiveClub(clubs[0].id);
  }, [clubs, setActiveClub, user?.role]);

  // Force the Control Center view while in club-less admin mode.
  React.useEffect(() => {
    if (ccOnly && useViewStore.getState().view !== "control-center") setView("control-center");
  }, [ccOnly, setView]);

  // Force the Wallet view while in deposit-escape mode.
  React.useEffect(() => {
    if (walletOnly && useViewStore.getState().view !== "wallet") setView("wallet");
  }, [walletOnly, setView]);

  useHeartbeat(true);

  // ── Maintenance gate (Task 27-f) ───────────────────────────────
  // While maintenance is ON, non-admins get a full-screen notice instead of the
  // game; admins keep the game plus the amber alert bar in the header. Safe
  // when the user is undefined: it blocks only when role !== "ADMIN".
  if (worldQuery.data?.maintenance?.enabled === true && user?.role !== "ADMIN") {
    const maintenanceMessage = worldQuery.data.maintenance.message;
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <div className="flex flex-1 items-center justify-center p-4">
          <div role="alert" className="w-full max-w-md rounded-xl border bg-card/60 p-8 text-center shadow-sm">
            <Construction aria-hidden="true" className="mx-auto size-10 text-amber-400" />
            <h1 className="mt-4 text-lg font-semibold">{t("game.shell.maintenanceTitle")}</h1>
            {maintenanceMessage && <p className="mt-2 text-sm text-foreground/90">{maintenanceMessage}</p>}
            <p className="mt-3 text-xs text-muted-foreground">{t("game.shell.maintenanceSub")}</p>
          </div>
        </div>
      </div>
    );
  }

  const gameDay = worldQuery.data?.gameDay;
  const footerClock = nowMs > 0 ? formatUtcClock(nowMs) : "--:--:--";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Skip link for keyboard users */}
      <a
        href="#game-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        {t("game.nav.main")}
      </a>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <MobileNav ccOnly={ccOnly} walletOnly={walletOnly} />
          <KnightLogo size={30} priority className="shrink-0" />
          <span className="hidden select-none text-sm font-bold tracking-widest text-primary xl:inline">
            KNIGHT&nbsp;FM
          </span>
          <Separator orientation="vertical" className="hidden xl:block xl:h-6" />

          <ClubIdentity clubs={clubs} isLoading={clubsQuery.isLoading} />

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:block"><WorldClock compact /></div>
            <PresenceGadget fallbackOnline={worldQuery.data?.presenceOnline ?? 0} />

            {!ccOnly && !walletOnly && (
              <Button
                variant="ghost"
                size="icon"
                className="relative min-h-11 min-w-11"
                aria-label={unread > 0 ? t("game.shell.unread", { n: unread }) : t("game.shell.inbox")}
                onClick={() => setView("inbox")}
              >
                <Mail aria-hidden="true" className="size-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Button>
            )}

            {user && <UserMenu user={user} />}
          </div>
        </div>
        {worldQuery.data?.maintenance?.enabled && (
          <div
            role="alert"
            className="flex items-center gap-2 bg-amber-500/15 px-4 py-1.5 text-xs text-amber-300"
          >
            <Activity aria-hidden="true" className="size-3.5" />
            {t("game.shell.maintenance", { message: worldQuery.data.maintenance.message || "" })}
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1">
        <Sidebar ccOnly={ccOnly} walletOnly={walletOnly} />
        <main id="game-main" className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          {ccOnly ? (
            <div className="space-y-4">
              <div
                role="status"
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3"
              >
                <Shield aria-hidden="true" className="size-5 shrink-0 text-amber-400" />
                <p className="min-w-0 flex-1 text-sm text-amber-200/90">{t("game.shell.ccOnlyBanner")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                  onClick={() => {
                    window.sessionStorage.removeItem("kfm.admin.ccOnly");
                    window.location.reload();
                  }}
                >
                  {t("game.shell.ccOnlyChoose")}
                </Button>
              </div>
              <ModuleSlot moduleKey="control-center" className="mx-auto max-w-6xl" />
            </div>
          ) : walletOnly ? (
            <div className="space-y-4">
              <div
                role="status"
                className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
              >
                <WalletIcon aria-hidden="true" className="size-5 shrink-0 text-primary" />
                <p className="min-w-0 flex-1 text-sm text-primary/90">{t("game.shell.walletOnlyBanner")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-9 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => {
                    window.sessionStorage.removeItem("kfm.onb.wallet");
                    setDepositEscape(false);
                  }}
                >
                  {t("game.shell.ccOnlyChoose")}
                </Button>
              </div>
              <ModuleSlot moduleKey="wallet" className="mx-auto max-w-6xl" />
            </div>
          ) : (
            <ActiveView clubs={clubs} />
          )}
        </main>
      </div>

      {/* ── Sticky footer (mt-auto keeps it down on short views) ── */}
      <footer className="mt-auto border-t bg-card/40 px-4 py-3">
        <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-3.5 text-primary/80" />
          {t("game.shell.footer", { clock: footerClock, day: gameDay ?? "—" })}
        </p>
      </footer>

      {/* ── Assistant FAB ─────────────────────────────────────────
          Requirement: the assistant must be reachable from EVERY game module
          (user request), so the entry point lives here in the shell, fixed
          above whatever view is active. The old top-bar assistant button was
          removed to avoid two duplicate entry points. On mobile the FAB sits
          at bottom-20 to keep clear of the thumb/nav zone. */}
      <Button
        size="icon"
        className="fixed bottom-20 right-4 z-40 size-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 sm:bottom-6 sm:right-6"
        onClick={() => setAssistantOpen(true)}
        aria-label={t("game.shell.assistant")}
        title={t("game.shell.assistant")}
      >
        <Bot className="size-6" aria-hidden="true" />
      </Button>

      <AssistantDialog open={assistantOpen} onOpenChange={setAssistantOpen} />
    </div>
  );
}
