// Knight FM — lista canónica de enlaces legales (LEGAL, Task 51).
// Fuente compartida por: el footer de la landing, la fila legal de "seguridad",
// el layout de las páginas legales y el banner de cookies. Cada entrada apunta
// a la ruta real o al ancla de sección (los slugs los genera slugifyHeading).

export const LEGAL_LINKS = [
  { id: "privacy", key: "landing.legal.privacy", href: "/privacy" },
  { id: "terms", key: "landing.legal.terms", href: "/terms" },
  { id: "cookies", key: "landing.legal.cookies", href: "/cookies" },
  { id: "play", key: "landing.legal.play", href: "/disclaimers#juego-responsable" },
  { id: "refunds", key: "landing.legal.refunds", href: "/terms#pagos-y-reembolsos" },
  { id: "token", key: "landing.legal.token", href: "/disclaimers#riesgo-del-token-y-de-los-criptoactivos" },
  { id: "dmca", key: "landing.legal.dmca", href: "/copyright" },
  { id: "notice", key: "landing.legal.notice", href: "/legal-notice" },
] as const;
