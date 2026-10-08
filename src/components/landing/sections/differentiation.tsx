"use client";
// Section 4 — Differentiation: comparison table vs traditional managers.

import { Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV } from "../analytics";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROWS = [
  "time",
  "sim",
  "pay",
  "themes",
  "assistant",
  "lang",
] as const;

export function Differentiation() {
  const { t } = useI18n();

  return (
    <SectionTracker
      event={EV.compareView}
      id="comparison"
      labelledBy="compare-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.compare.kicker"
          titleKey="landing.compare.title"
          subtitleKey="landing.compare.subtitle"
          headingId="compare-title"
        />

        <Reveal delay={0.1} className="mt-12">
          <div className="overflow-x-auto rounded-xl border bg-card/50">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="w-[34%] text-muted-foreground">
                    {t("landing.compare.colFeature")}
                  </TableHead>
                  <TableHead scope="col" className="w-[33%] font-bold text-primary">
                    {t("landing.compare.colKnight")}
                  </TableHead>
                  <TableHead scope="col" className="w-[33%] text-muted-foreground">
                    {t("landing.compare.colTrad")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ROWS.map((row) => (
                  <TableRow key={row}>
                    <TableCell className="font-medium">{t(`landing.compare.row.${row}.label`)}</TableCell>
                    <TableCell className="align-top">
                      <span className="flex items-start gap-2">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span className="text-sm">{t(`landing.compare.row.${row}.knight`)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="align-top">
                      <span className="flex items-start gap-2 text-muted-foreground">
                        <X aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                        <span className="text-sm">{t(`landing.compare.row.${row}.trad`)}</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Reveal>
      </div>
    </SectionTracker>
  );
}
