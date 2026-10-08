"use client";
// Knight FM — Settings view (Task 4-a + Task 24-a "Identidad del club").
// Theme selector grid (5 themes, instant preview), language selector, club
// identity editor (name / initials / crest shape / crest pattern / two brand
// colors with live crest preview), "return club to the system" danger zone,
// account info, session actions and honest data notice.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, Circle, Globe2, Landmark, LogOut, Moon, Palette,
  Settings as SettingsIcon, Shield, ShoppingBag, Square, Undo2, User,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTheme, THEMES } from "@/components/theme-provider";
import { LANGUAGES, type Language, type ThemeId } from "@/lib/themes";
import { useAuth, ApiError } from "@/components/auth/store";
import { useViewStore } from "@/components/game/view-store";
import { useActiveClub } from "@/components/game/hooks/use-active-club";
import { ClubCrest, KV } from "@/components/game/ui/bits";
import { useToast } from "@/hooks/use-toast";
import {
  fetchReleaseClub, fetchUpdateClubBrand, fetchWorldState, fetchClubProfile,
  qk, type ClubBadgeShape, type ClubCrestPattern, type ClubMine,
} from "@/components/game/api";

const SHAPES: ClubBadgeShape[] = ["shield", "circle", "square"];
const SHAPE_ICONS: Record<ClubBadgeShape, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  circle: Circle,
  square: Square,
};
const PATTERNS: ClubCrestPattern[] = [
  "solid", "stripes-v", "stripes-h", "halves", "quarters", "sash", "checker",
];
/** Predefined two-color swatches (~14, no default blue/indigo accent). */
const PALETTE = [
  "#10b981", "#059669", "#14b8a6", "#84cc16", "#eab308", "#f59e0b", "#f97316",
  "#ef4444", "#e11d48", "#ec4899", "#a855f7", "#8b5cf6", "#06b6d4", "#0f172a",
];

function errText(t: (k: string, v?: Record<string, string | number>) => string, err: unknown): string {
  const code = err instanceof ApiError ? err.code : "";
  return code && t(`game.err.${code}`) !== `game.err.${code}` ? t(`game.err.${code}`) : t("game.err.generic");
}

/** "stripes-v" → "stripesV" (i18n label keys are camelCased). */
function patternKey(p: string): string {
  return p === "stripes-v" ? "stripesV" : p === "stripes-h" ? "stripesH" : p;
}

// ── Club identity editor (Task 24-a) ────────────────────────────

function ClubBrandEditor({ club, nameLocked }: { club: ClubMine; nameLocked: boolean }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const brand = club.brand;

  const [name, setName] = React.useState(club.name);
  const [initials, setInitials] = React.useState(brand?.initials ?? club.name.slice(0, 3).toUpperCase());
  const [shape, setShape] = React.useState<ClubBadgeShape>(
    (brand?.badgeShape as ClubBadgeShape | undefined) ?? "shield"
  );
  const [pattern, setPattern] = React.useState<ClubCrestPattern>(
    (brand?.crestPattern as ClubCrestPattern | undefined) ?? "solid"
  );
  const [primary, setPrimary] = React.useState(brand?.primaryColor ?? "#10b981");
  const [secondary, setSecondary] = React.useState(brand?.secondaryColor ?? "#0b1220");

  const sameColors = primary.toLowerCase() === secondary.toLowerCase();
  const nameClean = name.trim();
  const nameValid = nameClean.length >= 3 && nameClean.length <= 32;
  const dirty =
    nameClean !== club.name ||
    initials !== (brand?.initials ?? initials) ||
    shape !== (brand?.badgeShape ?? "shield") ||
    pattern !== (brand?.crestPattern ?? "solid") ||
    primary !== (brand?.primaryColor ?? primary) ||
    secondary !== (brand?.secondaryColor ?? secondary);
  const canSave = dirty && !sameColors && nameValid;

  const saveMutation = useMutation({
    mutationFn: () =>
      fetchUpdateClubBrand({
        clubId: club.id,
        ...(nameClean !== club.name ? { name: nameClean } : {}),
        ...(initials !== (brand?.initials ?? initials) ? { initials } : {}),
        ...(shape !== (brand?.badgeShape ?? "shield") ? { badgeShape: shape } : {}),
        ...(pattern !== (brand?.crestPattern ?? "solid") ? { crestPattern: pattern } : {}),
        ...(primary !== (brand?.primaryColor ?? primary) ? { primaryColor: primary } : {}),
        ...(secondary !== (brand?.secondaryColor ?? secondary) ? { secondaryColor: secondary } : {}),
      }),
    onSuccess: (data) => {
      // Sync the draft with the server truth (sanitized name, stored colors).
      if (data.brand) {
        setPrimary(data.brand.primaryColor);
        setSecondary(data.brand.secondaryColor);
        setInitials(data.brand.initials);
        setShape((data.brand.badgeShape as ClubBadgeShape) ?? shape);
        setPattern((data.brand.crestPattern as ClubCrestPattern) ?? pattern);
      }
      if (data.club?.name) setName(data.club.name);
      toast({ description: t("game.settings.brand.saved") });
      void qc.invalidateQueries({ queryKey: qk.myClubs });
      void qc.invalidateQueries({ queryKey: qk.club(club.id) });
    },
    onError: (e) => {
      toast({ variant: "destructive", description: errText(t, e) });
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield aria-hidden="true" className="size-4 text-primary" />
          {t("game.settings.brand.title")}
        </CardTitle>
        <CardDescription>{t("game.settings.brand.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Live crest preview */}
        <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
          <ClubCrest
            primary={primary}
            secondary={secondary}
            shape={shape}
            pattern={pattern}
            initials={initials || club.name.slice(0, 3).toUpperCase()}
            size="lg"
            className="size-20 lg:size-24"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{nameClean || club.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("game.settings.brand.originalName", { name: club.originalName || club.name })}
            </p>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">{t("game.settings.brand.name")}</Label>
          <Input
            id="brand-name"
            value={name}
            maxLength={32}
            disabled={nameLocked || saveMutation.isPending}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="brand-name-help"
            className="h-11"
          />
          <p id="brand-name-help" className="text-xs text-muted-foreground">
            {t("game.settings.brand.nameHelp")}
          </p>
          {nameLocked && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-400" role="note">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              {t("game.settings.brand.nameLocked")}
            </p>
          )}
        </div>

        {/* Initials */}
        <div className="space-y-1.5">
          <Label htmlFor="brand-initials">{t("game.settings.brand.initials")}</Label>
          <Input
            id="brand-initials"
            value={initials}
            inputMode="text"
            maxLength={3}
            className="h-11 w-24 uppercase"
            onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
          />
        </div>

        {/* Shape */}
        <div className="space-y-1.5">
          <Label>{t("game.settings.brand.shape")}</Label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("game.settings.brand.shape")}>
            {SHAPES.map((s) => {
              const Icon = SHAPE_ICONS[s];
              const active = shape === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setShape(s)}
                  className={cn(
                    "flex h-11 min-w-24 items-center justify-center gap-2 rounded-md border px-3 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary/60 bg-primary/10 font-medium" : "bg-card hover:bg-accent/50"
                  )}
                >
                  <Icon aria-hidden="true" className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
                  {t(`game.settings.brand.shapeLabels.${s}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pattern */}
        <div className="space-y-1.5">
          <Label>{t("game.settings.brand.pattern")}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label={t("game.settings.brand.pattern")}>
            {PATTERNS.map((p) => {
              const active = pattern === p;
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPattern(p)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-md border p-2 text-left text-xs transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary/60 bg-primary/10 font-medium" : "bg-card hover:bg-accent/50"
                  )}
                >
                  <ClubCrest
                    primary={primary}
                    secondary={secondary}
                    shape={shape}
                    pattern={p}
                    initials={initials || club.name.slice(0, 3).toUpperCase()}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {t(`game.settings.brand.patternLabels.${patternKey(p)}`)}
                  </span>
                  {active && <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Colors */}
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { key: "primary", label: t("game.settings.brand.primary"), value: primary, set: setPrimary, other: secondary },
            { key: "secondary", label: t("game.settings.brand.secondary"), value: secondary, set: setSecondary, other: primary },
          ] as const).map((row) => (
            <div key={row.key} className="space-y-1.5">
              <Label htmlFor={`brand-${row.key}`}>{row.label}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`${row.label} ${c}`}
                    aria-pressed={row.value.toLowerCase() === c}
                    onClick={() => row.set(c)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      row.value.toLowerCase() === c ? "scale-110 border-foreground" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  id={`brand-${row.key}`}
                  type="color"
                  aria-label={`${row.label} (custom)`}
                  value={row.value}
                  onChange={(e) => row.set(e.target.value)}
                  className="h-9 w-10 cursor-pointer rounded-md border bg-card p-0.5"
                />
              </div>
            </div>
          ))}
        </div>

        {sameColors && (
          <p className="flex items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {t("game.settings.brand.sameColors")}
          </p>
        )}

        <Button
          className="h-11 w-full sm:w-auto"
          disabled={!canSave || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? "…" : t("game.settings.brand.save")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Danger zone: return the club to the system (Task 24-a) ─────

function ReleaseClubCard({ club }: { club: ClubMine }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const profileQ = useQuery({
    queryKey: qk.club(club.id),
    queryFn: () => fetchClubProfile(club.id),
    enabled: club.role === "OWNER" && !club.systemOwned,
  });
  const managerActive = profileQ.data?.club?.manager != null;

  const releaseMutation = useMutation({
    mutationFn: () => fetchReleaseClub(club.id),
    onSuccess: (res) => {
      toast({ description: t("game.settings.release.done", { name: res.name }) });
      void qc.invalidateQueries({ queryKey: qk.myClubs });
      void qc.invalidateQueries({ queryKey: qk.club(club.id) });
      void qc.invalidateQueries({ queryKey: qk.onboardingState });
    },
    onError: (e) => {
      toast({ variant: "destructive", description: errText(t, e) });
    },
  });

  if (club.systemOwned) return null;

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Undo2 aria-hidden="true" className="size-4" />
          {t("game.settings.release.title")}
        </CardTitle>
        <CardDescription>{t("game.settings.release.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">
                <Button
                  variant="destructive"
                  className="h-11 w-full sm:w-auto"
                  disabled={managerActive || releaseMutation.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  {t("game.settings.release.cta")}
                </Button>
              </span>
            </TooltipTrigger>
            {managerActive && <TooltipContent>{t("game.settings.release.managerBlock")}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("game.settings.release.confirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("game.settings.release.confirmDesc", { name: club.originalName || club.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11">{t("game.settings.release.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 bg-destructive text-white hover:bg-destructive/90"
                disabled={releaseMutation.isPending}
                onClick={(e) => {
                  e.preventDefault(); // keep the dialog open until the call settles
                  releaseMutation.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
                }}
              >
                {releaseMutation.isPending ? "…" : t("game.settings.release.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ── Settings view ───────────────────────────────────────────────

export default function SettingsView() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const setView = useViewStore((s) => s.setView);
  const { club } = useActiveClub();

  // Rename-window state needs the season start (world state); when unavailable
  // the editor simply relies on the server-side NAME_CHANGE_LOCKED error.
  const worldQ = useQuery({ queryKey: qk.world, queryFn: fetchWorldState });
  const seasonStart = worldQ.data?.season?.startEpochDay ?? null;
  const nameLocked =
    club !== null &&
    club.role === "OWNER" &&
    club.nameChangeDay !== null &&
    seasonStart !== null &&
    club.nameChangeDay >= seasonStart;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <SettingsIcon aria-hidden="true" className="size-5 text-primary" />
          {t("game.settings.title")}
        </h1>
      </header>

      {/* Club identity (owner only) */}
      {club && club.role === "OWNER" && <ClubBrandEditor key={club.id} club={club} nameLocked={nameLocked} />}
      {club && club.role === "OWNER" && <ReleaseClubCard key={`release-${club.id}`} club={club} />}

      {/* Theme selector grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette aria-hidden="true" className="size-4 text-primary" />
            {t("game.settings.theme")}
          </CardTitle>
          <CardDescription>{t("game.settings.themeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label={t("game.settings.theme")}>
            {THEMES.map((th) => {
              const active = theme === th.id;
              return (
                <button
                  key={th.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(th.id as ThemeId)}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary/60 bg-primary/10" : "bg-card hover:bg-accent/50"
                  )}
                >
                  <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
                    {th.swatch.map((c, i) => (
                      <span
                        key={i}
                        className="inline-block size-7 rounded-full border-2 border-background"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t(th.nameKey)}</span>
                  {active && <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Language selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe2 aria-hidden="true" className="size-4 text-primary" />
            {t("game.settings.language")}
          </CardTitle>
          <CardDescription>{t("game.settings.languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={t("game.settings.language")}>
            {LANGUAGES.map((l) => {
              const active = lang === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLang(l.id as Language)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-xl border p-3 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    active ? "border-primary/60 bg-primary/10 font-medium" : "bg-card hover:bg-accent/50"
                  )}
                >
                  <span aria-hidden="true">{l.flag}</span>
                  {l.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User aria-hidden="true" className="size-4 text-primary" />
            {t("game.settings.account")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <KV label={t("auth.field.username")}>{user.username}</KV>
              <KV label={t("auth.field.email")}>{user.email}</KV>
              <KV label={t("game.settings.role")}>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {user.role === "ADMIN" ? t("role.admin") : t("role.manager")}
                </Badge>
              </KV>
              <KV label={t("game.settings.path")}>
                <Badge variant="outline">
                  {user.path ? t(`game.settings.path.${user.path}`) : t("game.settings.path.NONE")}
                </Badge>
              </KV>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("game.dash.noClub")}</p>
          )}
          <Separator />
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <Moon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("game.settings.dataNotice")}</p>
          </div>
        </CardContent>
      </Card>

      {/* World info + quick links + session */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("game.settings.worldInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("game.settings.worldDesc")}</p>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => setView("markets")}>
                <ShoppingBag aria-hidden="true" className="mr-1.5 size-4" />
                {t("game.settings.goMarkets")}
              </Button>
              <Button variant="outline" size="sm" className="min-h-11" onClick={() => setView("treasury")}>
                <Landmark aria-hidden="true" className="mr-1.5 size-4" />
                {t("game.settings.goTreasury")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("game.settings.session")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => void logout()}
            >
              <LogOut aria-hidden="true" className="mr-1.5 size-4" />
              {t("game.shell.logout")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
