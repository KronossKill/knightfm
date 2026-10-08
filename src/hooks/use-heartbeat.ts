"use client";
// Knight FM — presence heartbeat (D-009): posts an authenticated heartbeat
// every 60s so the user counts toward the real-time "online" counter.
// IMPORTANT: this must go through `apiFetch` — the presence API is Bearer-only
// (no cookies), so a raw fetch here 401s silently and nobody ever shows online.

import * as React from "react";
import { apiFetch } from "@/components/auth/store";

export function useHeartbeat(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled) return;
    const ping = () => {
      void apiFetch("/api/presence/heartbeat", { method: "POST", body: {}, keepalive: true }).catch(
        () => undefined
      );
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
}
