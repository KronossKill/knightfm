// Knight FM — consentimiento de cookies/analítica (LEGAL, Task 51).
// Estado global ligero sin dependencias: localStorage + CustomEvent.
// "granted" → la analítica de primera parte puede emitir eventos.
// "denied"/null → la analística permanece bloqueada (el juego funciona igual).

export const CONSENT_STORAGE_KEY = "knightfm.consent";
export const CONSENT_EVENT = "knightfm:consent";

export type ConsentValue = "granted" | "denied";

/** Lee el consentimiento guardado. null = el usuario aún no ha decidido. */
export function getConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** Guarda la decisión y avisa al resto de la app (banner, footer, analítica). */
export function setConsent(value: ConsentValue): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
  } catch {
    // almacenamiento bloqueado: la decisión vive solo en esta pestaña
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

/** Borra la decisión guardada y reabre el banner (botón "Cookies" del footer). */
export function resetConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // noop
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: null }));
}

/** La analítica solo emite con consentimiento explícito (GDPR art. 6.1.a). */
export function hasAnalyticsConsent(): boolean {
  return getConsent() === "granted";
}
