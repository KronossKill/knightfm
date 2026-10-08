"use client";
// Knight FM — CAPTCHA client helper (Task 2-a, D-004).
// Sandbox: when NEXT_PUBLIC_TURNSTILE_SITE_KEY is not configured the Turnstile
// widget is not loaded at all and a fixed sandbox token is returned (the server
// sandbox provider only requires token presence — no external call, audited).
// Production: renders an invisible Cloudflare Turnstile widget and resolves
// with its token. Minimal, dependency-free.

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

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

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

/** Returns a captcha token: sandbox constant when Turnstile is not configured. */
export async function getCaptchaToken(): Promise<string> {
  if (!SITE_KEY) {
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
        sitekey: SITE_KEY,
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
