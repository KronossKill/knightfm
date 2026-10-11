"use client";
// Knight FM — Downloads panel (Task 87, rebuilt Task 90). Public delivery
// panel on the landing: lists EVERY file in public/downloads via /api/downloads
// (newest first) and hands each one a hardened download link:
//   - server sends `Content-Disposition: attachment` for /downloads/* (config)
//   - the anchor also carries `download` + `target="_blank"` + rel noopener
// so the file ALWAYS downloads — normal click, "open in new tab", middle
// click, pasted URL — and the app tab is never navigated away.

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, FileArchive, FileText, Loader2, RefreshCw } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionTracker } from "../analytics-tracker";
import { EV, track } from "../analytics";
import { Reveal } from "../reveal";

interface DownloadEntry {
  name: string;
  size: number;
  mtime: string;
  newest: boolean;
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

type Phase = "loading" | "ready" | "error" | "empty";

export function DownloadsPanel() {
  const { t } = useI18n();
  const [files, setFiles] = useState<DownloadEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch("/api/downloads", { cache: "no-store" });
      if (!res.ok) throw new String(res.status);
      // The API wraps payloads: { ok: true, data: { files: [...] } } — read
      // through the envelope with a tolerant fallback for a bare array.
      const payload = (await res.json()) as { data?: { files?: DownloadEntry[] }; files?: DownloadEntry[] };
      const list = Array.isArray(payload.data?.files) ? payload.data!.files! : Array.isArray(payload.files) ? payload.files : [];
      setFiles(list);
      setPhase(list.length === 0 ? "empty" : "ready");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SectionTracker
      event={EV.finalView}
      id="downloads"
      labelledBy="downloads-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center">
            <h2 id="downloads-title" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {t("landing.downloads.title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-pretty text-muted-foreground sm:text-lg">
              {t("landing.downloads.subtitle")}
            </p>
          </div>
        </Reveal>

        <div className="mt-8">
          {phase === "loading" && (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("landing.downloads.loading")}
            </p>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="size-4" aria-hidden="true" />
                {t("landing.downloads.error")}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("landing.downloads.retry")}
              </Button>
            </div>
          )}

          {phase === "empty" && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("landing.downloads.empty")}</p>
          )}

          {phase === "ready" && (
            <ul className="space-y-3">
              {files.map((f) => {
                const isZip = f.name.toLowerCase().endsWith(".zip");
                const isDoc = /\.(txt|docx|md|pdf)$/i.test(f.name);
                return (
                  <li key={f.name}>
                    <Card className={f.newest ? "border-primary/40" : undefined}>
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                        <span
                          className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                            f.newest ? "bg-primary/15 text-primary" : "bg-muted/60 text-muted-foreground"
                          }`}
                          aria-hidden="true"
                        >
                          {isZip ? (
                            <FileArchive className="size-5" />
                          ) : isDoc ? (
                            <FileText className="size-5" />
                          ) : (
                            <Download className="size-5" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block break-all text-sm font-semibold">{f.name}</span>
                            {f.newest && (
                              <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                                {t("landing.downloads.newest")}
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {humanSize(f.size)} ·{" "}
                            {new Date(f.mtime).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </span>

                        {/* Hardened link: `download` forces same-origin saving;
                            target=_blank guards any context that ignores it. The
                            server ALSO sends Content-Disposition: attachment. */}
                        <a
                          href={`/downloads/${encodeURIComponent(f.name)}`}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => track("landing_download_click", { file: f.name, newest: f.newest })}
                          className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                            f.newest
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "border border-primary/30 bg-primary/5 hover:bg-primary/15"
                          }`}
                        >
                          <Download className="size-4" aria-hidden="true" />
                          {t("landing.downloads.open")}
                        </a>
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </SectionTracker>
  );
}
