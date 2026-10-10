"use client";
// Knight FM — CAPTCHA client helper (Task 2-a, D-004; runtime-config hardening).
//
// The client asks the SERVER which captcha mode is active (GET /api/auth/
// captcha-config) instead of relying on a build-time NEXT_PUBLIC_ variable.
// This removes the deploy race where env vars were saved after the build:
// a bundle without the inlined site key used to send sandbox tokens while the
// server demanded real Turnstile verification — locking every user out.
//
// Sandbox mode (nothing configured): a fixed presence-only token is returned;
// the server sandbox provider only requires token presence (audited, D-004).
// Turnstile mode: renders an invisible Cloudflare widget and resolves with its
// token. Minimal, dependency-free.

interface TurnstileApi {
  render: (
    el: HTMLElement,
    params: {
      sitekey: string;
      callback: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "flexible";
    }
  ) => string | undefined;
  reset: (id?: string) => void;
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

let configPromise: Promise<CaptchaConfig> | null = null;
let scriptPromise: Promise<void> | null = null;

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
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("TURNSTILE_SCRIPT_ERROR")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("TURNSTILE_SCRIPT_ERROR"));
    };
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
  await loadTurnstile();
  return new Promise<string>((resolve, reject) => {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.width = "1px";
    container.style.height = "1px";
    document.body.appendChild(container);

    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      container.remove();
      fn();
    };

    try {
      window.turnstile?.render(container, {
        sitekey: cfg.siteKey,
        theme: "dark",
        callback: (token) => finish(() => resolve(token)),
        "error-callback": () => finish(() => reject(new Error("TURNSTILE_ERROR"))),
        "expired-callback": () => finish(() => reject(new Error("TURNSTILE_EXPIRED"))),
      });
    } catch {
      finish(() => reject(new Error("TURNSTILE_RENDER_FAILED")));
    }
  });
}
