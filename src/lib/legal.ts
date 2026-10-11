// Knight FM — cargador de documentos legales (LEGAL, Task 51; multi-idioma Task 52-g).
// Fuente única de verdad: Markdown en src/content/legal/*.md (espejo en docs/legal/).
// Multi-idioma: src/content/legal/{en,fr,pt}/*.md (traducidos en Task 52-d/e/f) con
// fallback honesto al español si falta la versión localizada.
// Solo servidor: lee el fichero bajo demanda; los .md viajan con el bundle
// standalone vía outputFileTracingIncludes (next.config.ts, glob ** cubre subcarpetas).

import { readFileSync } from "fs";
import { join } from "path";
import { cookies } from "next/headers";

export type LegalSlug =
  | "terminos-condiciones"
  | "politica-privacidad"
  | "politica-cookies"
  | "copyright-dmca"
  | "descargos-responsabilidad"
  | "aviso-legal";

const DIR = join(process.cwd(), "src", "content", "legal");

/** Versión del texto legal exigida en el registro (evidencia de consentimiento). */
export const LEGAL_TERMS_VERSION = "v1";

/** Idiomas con documentos legales servidos (es = fuente canónica; en/fr/pt = Task 52). */
export const LEGAL_LOCALES = ["es", "en", "fr", "pt"] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

export function isLegalLocale(v: string | undefined | null): v is LegalLocale {
  return !!v && (LEGAL_LOCALES as readonly string[]).includes(v);
}

/**
 * Locale efectivo para documentos legales: cookie `knightfm.lang`
 * (sincronizada por I18nProvider) → "es" por defecto (idioma primario del spec).
 */
export async function getLegalLocale(): Promise<LegalLocale> {
  try {
    const store = await cookies();
    const v = store.get("knightfm.lang")?.value;
    return isLegalLocale(v) ? v : "es";
  } catch {
    return "es";
  }
}

/** Lee y devuelve el Markdown crudo de un documento legal en el locale pedido. */
export function readLegalDoc(file: `${LegalSlug}.md`, locale: LegalLocale = "es"): string {
  if (locale !== "es") {
    try {
      return readFileSync(join(DIR, locale, file), "utf8");
    } catch {
      // Fallback honesto al español si falta la versión traducida.
    }
  }
  return readFileSync(join(DIR, file), "utf8");
}
