"use client";
// Knight FM — CAPTCHA client helper (Task 2-a, D-004; runtime-config hardening).
//
// The client asks the SERVER which captcha mode is active (GET /api/auth/
// captcha-config) instead of relying on a build-time NEXT_PUBLIC_ variable.
// This removes the deploy race where env vars were saved after the build:
// a bundle without the inlined site key used to send sandbox tokens while the
// server demanded real Turnstile verification — locking every user out.
//
// Resilience: a blocked script (CSP, ad-blockers, offline) must never hang the
// UI. The script element is state-marked so retries settle immediately, and
// every acquisition step runs under a hard timeout → callers always get either
// a token or a rejection they can show.
//
// Sandbox mode (nothing configured): a fixed presence-only token is returned;
// the server sandbox provider only requires token presence (audited, D-004).

interface TurnstileApi {
  render: (
    el: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: (code?: string) => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible";
    }
  ) => string | undefined;
  reset: (id?: string) => void;
  remove?: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface CaptchaConfig {
  provider: string;
  siteKey: string | null;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const CAPTCHA_TIMEOUT_MS = 15_000;

let configPromise: Promise<CaptchaConfig> | null = null;
let scriptPromise: Promise<void> | null = null;

function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), CAPTCHA_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** Fetches the effective captcha config once per page load (server truth). */
function loadConfig(): Promise<CaptchaConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/auth/captcha-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const data = (j && typeof j === "object" && "data" in j ? (j as { data: CaptchaConfig }).data : (j as CaptchaConfig)) ?? {};
        return { provider: String(data.provider ?? "sandbox"), siteKey: data.siteKey ?? null };
      })
      .catch(() => ({ provider: "sandbox", siteKey: null }) as CaptchaConfig);
  }
  return configPromise;
}

function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("NO_WINDOW"));
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const fail = (el: HTMLScriptElement) => {
      // Mark + remove so a later retry rebuilds the element from scratch
      // (a stale failed script in <head> would leave listeners never-attached
      // and hang every subsequent attempt — the infinite-spinner bug).
      el.setAttribute("data-kf-turnstile", "error");
      el.remove();
      scriptPromise = null;
      reject(new Error("TURNSTILE_SCRIPT_ERROR"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      const state = existing.getAttribute("data-kf-turnstile");
      if (state === "loaded") {
        resolve();
      } else if (state === "error") {
        fail(existing);
      } else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => fail(existing));
      }
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.addEventListener("load", () => {
      s.setAttribute("data-kf-turnstile", "loaded");
      resolve();
    });
    s.addEventListener("error", () => fail(s));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/** Returns a captcha token: sandbox constant when Turnstile is not active. */
export async function getCaptchaToken(): Promise<string> {
  const cfg = await loadConfig();
  if (cfg.provider !== "cloudflare_turnstile" || !cfg.siteKey) {
    // Sandbox provider (D-004): presence-only token, validated server-side by audit.
    return "sandbox-knight-token";
  }
  // Task 70: surface which key tail is deployed (site keys are public — the
  // tail is enough to compare against the Cloudflare dashboard without).
  console.info(
    `[CAPTCHA] Turnstile activo (siteKey …${cfg.siteKey.slice(-6)}). ` +
      "Si falla: verifica que esa Site Key sea la del widget y que «" +
      window.location.hostname +
      "» esté en los Hostnames del widget en Cloudflare."
  );
  await withTimeout(loadTurnstile(), "TURNSTILE_TIMEOUT");
  return withTimeout(
    new Promise<string>((resolve, reject) => {
      const container = document.createElement("div");
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.width = "1px";
      container.style.height = "1px";
      document.body.appendChild(container);

      let settled = false;
      let widgetId: string | undefined;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        // Task 72: unregister the widget first so Turnstile doesn't keep a
        // dangling reference ("Cannot find widget cf-chl-widget-*" warnings)
        // and the container can be dropped safely.
        if (widgetId) {
          try {
            window.turnstile?.remove?.(widgetId);
          } catch {
            // Best-effort cleanup only.
          }
        }
        container.remove();
        fn();
      };

      try {
        widgetId = window.turnstile?.render(container, {
          sitekey: cfg.siteKey,
          theme: "dark",
          callback: (token) => finish(() => resolve(token)),
          // Task 70: Turnstile reports machine-readable codes on failure
          // (110200 = domain not allowed, 110420 = invalid sitekey, …).
          // Propagate the code so the UI and the console pinpoint the cause.
          "error-callback": (code?: string) => {
            const ec = typeof code === "string" && code ? code : "UNKNOWN";
            console.error(
              `[CAPTCHA] Turnstile widget error ${ec} — causas típicas: ` +
                "Site Key y Secret Key intercambiadas en Vercel, o el dominio " +
                "no está en los Hostnames del widget."
            );
            finish(() => reject(new Error(`TURNSTILE_ERROR_${ec}`)));
          },
          "expired-callback": () => finish(() => reject(new Error("TURNSTILE_EXPIRED"))),
        });
      } catch {
        finish(() => reject(new Error("TURNSTILE_RENDER_FAILED")));
      }
    }),
    "TURNSTILE_TIMEOUT"
  );
}
