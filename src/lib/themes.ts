// Knight FM — visual themes (spec §32). One design system, six user-selectable themes.
// Theme selection never changes game state. All themes meet WCAG AA contrast.

export const THEMES = [
  { id: "onyx", nameKey: "themes.onyx", swatch: ["#0a0a0a", "#10b981", "#f59e0b"] },
  { id: "knight-emerald", nameKey: "themes.knightEmerald", swatch: ["#0b1220", "#10b981", "#d4af37"] },
  { id: "obsidian", nameKey: "themes.obsidian", swatch: ["#09090b", "#fafafa", "#a1a1aa"] },
  { id: "royal", nameKey: "themes.royal", swatch: ["#0a1128", "#c9a227", "#e5e7eb"] },
  { id: "aurora", nameKey: "themes.aurora", swatch: ["#111827", "#34d399", "#818cf8"] },
  { id: "classic", nameKey: "themes.classic", swatch: ["#0f1f17", "#15803d", "#e7e5e4"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "onyx";
export const isValidTheme = (id: string): id is ThemeId => THEMES.some((t) => t.id === id);

export const LANGUAGES = [
  { id: "es", name: "Español", flag: "🇪🇸" },
  { id: "en", name: "English", flag: "🇬🇧" },
  { id: "fr", name: "Français", flag: "🇫🇷" },
  { id: "pt", name: "Português", flag: "🇵🇹" },
] as const;
export type Language = (typeof LANGUAGES)[number]["id"];
export const DEFAULT_LANGUAGE: Language = "es";
export const isValidLanguage = (id: string): id is Language => LANGUAGES.some((l) => l.id === id);
