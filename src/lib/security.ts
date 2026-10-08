// Knight FM — free-text sanitization helpers.
//
// React already escapes anything rendered as JSX text, but persisted user
// strings can flow to non-React sinks (emails, exports, admin consoles,
// rich-text embeds) — normalize them at the perimeter instead of trusting
// every future consumer.

/**
 * Removes control characters (C0 U+0000–U+001F, DEL U+007F, C1 U+0080–U+009F),
 * collapses whitespace runs into single spaces, trims, and hard-cuts to
 * `maxLen` code points. Emoji and non-Latin scripts are preserved.
 * Defensive against non-string input (returns "").
 */
export function sanitizeText(input: string, maxLen: number): string {
  if (typeof input !== "string") return "";
  const max = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 0;
  let out = "";
  for (const ch of input) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f)) continue; // C0 + DEL + C1
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Escapes the five HTML-significant characters (& < > " ').
 * Only needed for non-React sinks; React JSX escapes by default.
 */
export function escapeHtml(s: string): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
