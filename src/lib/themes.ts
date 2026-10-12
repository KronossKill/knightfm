// Knight FM — visual themes (spec §32). One design system, six user-selectable themes.
// Theme selection never changes game state. All themes meet WCAG AA contrast.

export const THEMES = [
  // Task 103: "nexus" implements the user's DOCX "Diseño visual definitivo"
  // (night blue #0A0F18 / slate #151E2D / lime #B7F34A / cold white #E8EEF6)
  // and is the new default for both new and existing users who never picked a
  // theme explicitly.
  { id: "nexus", nameKey: "themes.nexus", swatch: ["#0A0F18", "#B7F34A", "#E8EEF6"] },
  { id: "knight-emerald", nameKey: "themes.knightEmerald", swatch: ["#0b1220", "#10b981", "#d4af37"] },
  { id: "obsidian", nameKey: "themes.obsidian", swatch: ["#09090b", "#fafafa", "#a1a1aa"] },
  { id: "royal", nameKey: "themes.royal", swatch: ["#0a1128", "#c9a227", "#e5e7eb"] },
  { id: "aurora", nameKey: "themes.aurora", swatch: ["#111827", "#34d399", "#818cf8"] },
  { id: "classic", nameKey: "themes.classic", swatch: ["#f3f8f4", "#167a46", "#0f2e1d"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const DEFAULT_THEME: ThemeId = "nexus";
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
