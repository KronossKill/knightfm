// Knight FM — landing analytics (spec §47.1).
// Fire-and-forget event collector: never blocks the UI, never throws, never fabricates data.

const ENDPOINT = "/api/analytics/collect";

/** Canonical landing event names (spec §47.1). */
export const EV = {
  view: "landing_view",
  heroView: "landing_hero_view",
  heroCtaPrimary: "landing_hero_cta_primary_click",
  heroCtaSecondary: "landing_hero_cta_secondary_click",
  valuePillarView: "landing_value_pillar_view",
  valuePillarExpand: "landing_value_pillar_expand",
  howView: "landing_how_it_works_view",
  stepClick: "landing_step_click",
  compareView: "landing_comparison_view",
  kmieView: "landing_kmie_view",
  kmieReplay: "landing_kmie_watch_replay",
  worldView: "landing_world_view",
  themesView: "landing_themes_view",
  themePreview: "landing_theme_preview_click",
  assistantView: "landing_assistant_view",
  economyView: "landing_economy_view",
  whitepaper: "landing_whitepaper_click",
  proofView: "landing_social_proof_view",
  securityView: "landing_security_view",
  legalLink: "landing_legal_link_click",
  finalView: "landing_final_cta_view",
  finalSubmit: "landing_final_cta_submit",
  footerClick: "landing_footer_click",
  languageChange: "landing_language_change",
  themeChange: "landing_theme_change",
  scrollDepth: "landing_scroll_depth",
} as const;

/**
 * Fire-and-forget analytics event. POSTs to the collect endpoint and swallows
 * every error (endpoint may not exist yet — that must never break the page).
 */
export function track(event: string, props?: Record<string, unknown>) {
  const payload = { event, props: props ?? {}, ts: Date.now() };
  if (process.env.NODE_ENV !== "production") {
    console.debug("[landing:analytics]", event, payload.props);
  }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // noop — analytics must never throw
  }
}
