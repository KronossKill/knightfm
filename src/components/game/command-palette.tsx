"use client";
// Knight FM — GLOBAL COMMAND PALETTE v2.0 (Master UI/UX v2.0).
// VS-Code/Linear-style power-user layer: jump to any screen, switch theme /
// language, search the active squad. Open with Ctrl+K / Cmd+K (shell hotkey)
// or the top-bar search button.
//
// v2.0 additions over Task 91:
//  · FAVORITES — star any navigation item; favorites persist in localStorage
//    and float to the top group (alongside recents).
//  · STACK NAVIGATION — drill into scoped contexts (players / themes /
//    languages); Backspace with an empty query POPS the stack like a
//    mini-router (Backspace at root closes the palette). A breadcrumb row
//    always shows where you are, so there are no dead ends.

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bot,
  Building2,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  Globe2,
  Landmark,
  LayoutDashboard,
  Mail,
  MonitorCog,
  Palette,
  Search,
  Settings as SettingsIcon,
  Shirt,
  Star,
  Trophy,
  Users,
  UsersRound,
  Wallet as WalletIcon,
} from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES } from "@/components/theme-provider";
import { LANGUAGES, type Language, type ThemeId } from "@/lib/themes";
import { useViewStore, type GameView } from "@/components/game/view-store";
import { useAuth } from "@/components/auth/store";
import { fetchPlayers, type PlayerRow } from "@/components/game/api";
import { cn } from "@/lib/utils";

const RECENTS_KEY = "knightfm.palette.recents";
const FAVORITES_KEY = "knightfm.palette.favorites";

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}

function pushRecent(id: string) {
  writeIds(RECENTS_KEY, [id, ...readIds(RECENTS_KEY).filter((r) => r !== id)].slice(0, 5));
}

function toggleFavorite(id: string): boolean {
  const favs = readIds(FAVORITES_KEY);
  const next = favs.includes(id) ? favs.filter((f) => f !== id) : [id, ...favs].slice(0, 8);
  writeIds(FAVORITES_KEY, next);
  return next.includes(id);
}

interface NavTarget {
  view: GameView;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  recentId: string;
}

const NAV_TARGETS: NavTarget[] = [
  { view: "dashboard", labelKey: "game.nav.dashboard", icon: LayoutDashboard, recentId: "nav:dashboard" },
  { view: "squad", labelKey: "game.nav.squad", icon: Users, recentId: "nav:squad" },
  { view: "tactics", labelKey: "game.nav.tactics", icon: Shirt, recentId: "nav:tactics" },
  { view: "training", labelKey: "game.nav.training", icon: Dumbbell, recentId: "nav:training" },
  { view: "facilities", labelKey: "game.nav.facilities", icon: Building2, recentId: "nav:facilities" },
  { view: "staff", labelKey: "game.nav.staff", icon: UsersRound, recentId: "nav:staff" },
  { view: "youth", labelKey: "game.nav.youth", icon: FlaskConical, recentId: "nav:youth" },
  { view: "competitions", labelKey: "game.nav.competitions", icon: Trophy, recentId: "nav:competitions" },
  { view: "markets", labelKey: "game.nav.markets", icon: Landmark, recentId: "nav:markets" },
  { view: "treasury", labelKey: "game.nav.treasury", icon: Landmark, recentId: "nav:treasury" },
  { view: "wallet", labelKey: "game.nav.wallet", icon: WalletIcon, recentId: "nav:wallet" },
  { view: "inbox", labelKey: "game.nav.inbox", icon: Mail, recentId: "nav:inbox" },
  { view: "assistant", labelKey: "game.shell.assistant", icon: Bot, recentId: "nav:assistant" },
  { view: "settings", labelKey: "game.nav.settings", icon: SettingsIcon, recentId: "nav:settings" },
  { view: "control-center", labelKey: "game.nav.controlCenter", icon: MonitorCog, recentId: "nav:control-center" },
];

const RECENT_VIEW: Record<string, GameView> = Object.fromEntries(NAV_TARGETS.map((n) => [n.recentId, n.view]));

// Scoped contexts for stack navigation ("mini-router" mandate).
type PaletteCtx = "root" | "players" | "themes" | "langs";
const CTX_CRUMB: Record<Exclude<PaletteCtx, "root">, string> = {
  players: "game.palette.drillPlayers",
  themes: "game.palette.drillThemes",
  langs: "game.palette.drillLangs",
};

/** Trailing star toggle — stops propagation so the row's onSelect doesn't fire. */
function FavoriteStar({ active, onToggle, label }: { active: boolean; onToggle: () => void; label: string }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      role="button"
      aria-pressed={active}
      aria-label={active ? t("game.palette.favRemove") : t("game.palette.favAdd")}
      title={label}
      className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      <Star aria-hidden="true" className={cn("size-4", active && "fill-primary text-primary")} />
    </button>
  );
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const setView = useViewStore((s) => s.setView);
  const { user } = useAuth();
  const activeClubId = useViewStore((s) => s.activeClubId);
  const [stack, setStack] = React.useState<PaletteCtx[]>(["root"]);
  const [query, setQuery] = React.useState("");
  const [recents, setRecents] = React.useState<string[]>([]);
  const [favs, setFavs] = React.useState<string[]>([]);
  const [players, setPlayers] = React.useState<PlayerRow[] | null>(null);
  const ctx = stack[stack.length - 1];

  // Fresh state + recents/favorites every time the palette opens.
  React.useEffect(() => {
    if (open) {
      setStack(["root"]);
      setQuery("");
      setRecents(readIds(RECENTS_KEY).slice(0, 5));
      setFavs(readIds(FAVORITES_KEY));
    }
  }, [open]);

  // Squad search source (active club only; loaded lazily while the palette is open).
  React.useEffect(() => {
    if (!open || !activeClubId || players !== null) return;
    let alive = true;
    fetchPlayers(activeClubId)
      .then((res) => {
        if (alive) setPlayers(res.players ?? []);
      })
      .catch(() => {
        if (alive) setPlayers([]);
      });
    return () => {
      alive = false;
    };
  }, [open, activeClubId, players]);

  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);

  const run = (recentId: string, action: () => void) => {
    pushRecent(recentId);
    action();
    close();
  };

  const pop = React.useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  // Mini-router: Backspace with an empty query pops the stack; at root it
  // closes the palette (Escape also closes via the dialog itself).
  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Backspace" || query.length > 0) return;
    e.preventDefault();
    if (stack.length > 1) {
      pop();
    } else {
      close();
    }
  };

  const starFor = (recentId: string) => (
    <FavoriteStar
      active={favs.includes(recentId)}
      onToggle={() => {
        toggleFavorite(recentId);
        setFavs(readIds(FAVORITES_KEY));
      }}
      label={t(favs.includes(recentId) ? "game.palette.favRemove" : "game.palette.favAdd")}
    />
  );

  const navItem = (n: NavTarget) => {
    const Icon = n.icon;
    return (
      <CommandItem key={n.recentId} value={`${t(n.labelKey)} ${n.recentId}`} onSelect={() => run(n.recentId, () => setView(n.view))}>
        <Icon aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
        {t(n.labelKey)}
        {ctx === "root" && starFor(n.recentId)}
      </CommandItem>
    );
  };

  const navTargets = NAV_TARGETS.filter((n) => !(n.view === "control-center" && user?.role !== "ADMIN"));
  const recentTargets = recents
    .map((id) => NAV_TARGETS.find((n) => n.recentId === id))
    .filter((n): n is NavTarget => !!n);
  const favTargets = favs
    .map((id) => NAV_TARGETS.find((n) => n.recentId === id))
    .filter((n): n is NavTarget => !!n);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Breadcrumb — stack position always visible (no dead ends). */}
      <div className="flex items-center gap-1 border-b px-3 pb-2 pt-3 text-xs text-muted-foreground" aria-hidden={stack.length === 1}>
        <button
          type="button"
          className="rounded px-1 py-0.5 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => (stack.length > 1 ? pop() : close())}
          tabIndex={stack.length > 1 ? 0 : -1}
        >
          {t("game.palette.crumbRoot")}
        </button>
        {stack.slice(1).map((c, i) => (
          <span key={`${c}-${i}`} className="flex items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3" />
            <span className="font-medium text-foreground">{t(CTX_CRUMB[c])}</span>
          </span>
        ))}
        {stack.length > 1 && (
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] font-semibold">⌫</kbd>
            {t("game.palette.back")}
          </span>
        )}
      </div>

      <CommandInput value={query} onValueChange={setQuery} placeholder={t("game.palette.placeholder")} />
      <CommandList onKeyDown={onListKeyDown}>
        <CommandEmpty>{t("game.palette.noResults")}</CommandEmpty>

        {ctx === "root" && (
          <>
            {favTargets.length > 0 && (
              <>
                <CommandGroup heading={t("game.palette.favorites")}>
                  {favTargets.map(navItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {recentTargets.length > 0 && (
              <>
                <CommandGroup heading={t("game.palette.recent")}>
                  {recentTargets.map(navItem)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading={t("game.palette.nav")}>{navTargets.map(navItem)}</CommandGroup>

            <CommandSeparator />
            <CommandGroup heading={t("game.palette.actions")}>
              <CommandItem value={`${t("game.palette.drillPlayers")} drill`} onSelect={() => { setStack(["root", "players"]); setQuery(""); }}>
                <Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t("game.palette.drillPlayers")}
                <ChevronRight aria-hidden="true" className="ml-auto size-3.5 text-muted-foreground" />
              </CommandItem>
              <CommandItem value={`${t("game.palette.drillThemes")} drill`} onSelect={() => { setStack(["root", "themes"]); setQuery(""); }}>
                <Palette aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t("game.palette.drillThemes")}
                <ChevronRight aria-hidden="true" className="ml-auto size-3.5 text-muted-foreground" />
              </CommandItem>
              <CommandItem value={`${t("game.palette.drillLangs")} drill`} onSelect={() => { setStack(["root", "langs"]); setQuery(""); }}>
                <Globe2 aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t("game.palette.drillLangs")}
                <ChevronRight aria-hidden="true" className="ml-auto size-3.5 text-muted-foreground" />
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />
            <CommandGroup heading={t("game.palette.finance")}>
              <CommandItem onSelect={() => run("nav:wallet", () => setView("wallet"))}>
                <ArrowDownToLine aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t("game.palette.deposit")}
              </CommandItem>
              <CommandItem onSelect={() => run("nav:treasury", () => setView("treasury"))}>
                <ArrowUpFromLine aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t("game.nav.treasury")}
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {ctx === "players" && activeClubId && players !== null && players.length > 0 && (
          <CommandGroup heading={t("game.palette.players")}>
            {players.slice(0, 60).map((p) => (
              <CommandItem
                key={p.id}
                value={`${p.firstName} ${p.lastName} ${p.detailedPos} ${p.position}`}
                onSelect={() => run(`player:${p.id}`, () => setView("squad"))}
              >
                <Users aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {p.firstName} {p.lastName}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {p.ovr} · {p.detailedPos}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {ctx === "themes" && (
          <CommandGroup heading={t("game.palette.themes")}>
            {THEMES.map((th) => (
              <CommandItem
                key={th.id}
                onSelect={() => run(`theme:${th.id}`, () => setTheme(th.id as ThemeId))}
                className={cn(theme === th.id && "bg-primary/10")}
              >
                <Palette aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {t(th.nameKey)}
                {theme === th.id && (
                  <span className="sr-only">({t("common.yes")})</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {ctx === "langs" && (
          <CommandGroup heading={t("game.palette.language")}>
            {LANGUAGES.map((l) => (
              <CommandItem
                key={l.id}
                onSelect={() => run(`lang:${l.id}`, () => setLang(l.id as Language))}
                className={cn(lang === l.id && "bg-primary/10")}
              >
                <Globe2 aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                {l.flag} {l.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Global keyboard shortcut handler — mounted ONCE in the shell. */
export function useCommandPaletteHotkey(onOpen: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}

/** Small search button for the top bar (opens the palette). */
export function PaletteTriggerButton({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="hidden h-9 min-w-40 items-center gap-2 rounded-md border bg-card/50 px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex xl:min-w-56"
      aria-label={t("game.palette.open")}
      aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
    >
      <Search aria-hidden="true" className="size-3.5" />
      <span className="flex-1 truncate text-left">{t("game.palette.placeholder")}</span>
      <kbd className="rounded border bg-muted px-1.5 font-mono text-[10px] font-semibold">{isMac ? "⌘K" : "Ctrl+K"}</kbd>
    </button>
  );
}
