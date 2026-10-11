"use client";
// Downloads panel (Task 81) — dynamic index of every deliverable published in
// /public/downloads. Rendered inside the landing footer docs box. The newest
// ZIP is highlighted as the current package; every other file sits in a
// scrollable history below. Any file dropped into public/downloads appears
// here automatically — no code changes, no manual URLs, ever.

import * as React from "react";
import {
  Download,
  FileArchive,
  FileText,
  PackageOpen,
  RefreshCw,
  Sparkles,
  Table2,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { EV, track } from "../analytics";

interface DownloadEntry {
  name: string;
  size: number;
  modifiedAt: string;
}

function iconFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return FileArchive;
  if (lower.endsWith(".sql")) return Table2;
  return FileText;
}

function sizeLabel(
  bytes: number,
  formatNumber: (n: number, opts?: Intl.NumberFormatOptions) => string,
): string {
  if (bytes >= 1024 * 1024) {
    return `${formatNumber(bytes / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
  }
  if (bytes >= 1024) {
    return `${formatNumber(bytes / 1024, { maximumFractionDigits: 0 })} KB`;
  }
  return `${formatNumber(bytes)} B`;
}

export function DownloadsPanel() {
  const { t, formatDate, formatNumber } = useI18n();
  const [files, setFiles] = React.useState<DownloadEntry[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  const load = React.useCallback(() => {
    setFailed(false);
    setFiles(null);
    fetch("/api/downloads", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { files?: DownloadEntry[] };
        setFiles(Array.isArray(data.files) ? data.files : []);
      })
      .catch(() => setFailed(true));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  // Newest ZIP = current package (LEEME .txt siblings share the moment but the
  // zip is what the user must download).
  const latest = React.useMemo(
    () => files?.find((f) => f.name.toLowerCase().endsWith(".zip")) ?? null,
    [files],
  );
  const rest = React.useMemo(
    () => (files ? files.filter((f) => f.name !== latest?.name) : []),
    [files, latest],
  );

  if (failed) {
    return (
      <div className="mt-4 flex flex-col items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t("landing.footer.updatesError")}</p>
        <Button type="button" size="sm" variant="outline" onClick={load}>
          <RefreshCw aria-hidden="true" className="size-4" />
          {t("landing.footer.retry")}
        </Button>
      </div>
    );
  }

  if (files === null) {
    return (
      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-16 animate-pulse rounded-md bg-muted/60" />
        <div className="h-10 animate-pulse rounded-md bg-muted/40" />
        <div className="h-10 animate-pulse rounded-md bg-muted/40" />
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">{t("landing.footer.updatesEmpty")}</p>
    );
  }

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2">
        <PackageOpen aria-hidden="true" className="size-4 text-primary" />
        <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {t("landing.footer.updates")}
        </h4>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("landing.footer.updatesHint")}</p>

      {latest && (
        <div className="mt-3 rounded-lg border-2 border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <FileArchive className="size-5" />
              </span>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  <Sparkles className="size-3" aria-hidden="true" />
                  {t("landing.footer.latestBadge")}
                </span>
                <p className="mt-1 truncate text-sm font-semibold" title={latest.name}>
                  {latest.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {sizeLabel(latest.size, formatNumber)} ·{" "}
                  {formatDate(latest.modifiedAt, { dateStyle: "medium" })}
                </p>
              </div>
            </div>
            <a
              href={`/downloads/${encodeURIComponent(latest.name)}`}
              download
              onClick={() => track(EV.footerClick, { link: `dl:${latest.name}` })}
              className="group flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("landing.footer.download")}
            </a>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {rest.map((f) => {
            const Icon = iconFor(f.name);
            return (
              <li key={f.name}>
                <a
                  href={`/downloads/${encodeURIComponent(f.name)}`}
                  download
                  onClick={() => track(EV.footerClick, { link: `dl:${f.name}` })}
                  className="group flex items-center gap-3 rounded-md border border-border/50 bg-background/40 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium" title={f.name}>
                    {f.name}
                  </span>
                  <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">
                    {sizeLabel(f.size, formatNumber)} ·{" "}
                    {formatDate(f.modifiedAt, { dateStyle: "medium" })}
                  </span>
                  <Download
                    aria-hidden="true"
                    className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                  />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
