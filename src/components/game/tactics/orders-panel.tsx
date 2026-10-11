"use client";
// Knight FM — tactical orders panel (October, KMIE v3).
// Compact card with the 8 manager orders the engine applies every match minute:
// 5 string selects (mentality / pressing / tempo / width / defensive line) +
// 3 switches (counterattack / offside trap / time wasting). Guardar persists a
// PARTIAL-merge PUT /api/tactics; the server stays the authority.

import { useMemo, useState } from "react";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/components/auth/store";
import { cn } from "@/lib/utils";
import {
  ManagerOrders,
  MANAGER_ORDERS_OPTIONS,
  normalizeOrders,
  useSaveOrders,
} from "./use-tactics";

interface OrdersPanelProps {
  clubId: string;
  /** Saved orders from GET /api/tactics (server authority). */
  orders: ManagerOrders | null | undefined;
}

const STRING_ORDER_KEYS = ["mentality", "pressing", "tempo", "width", "defensiveLine"] as const;
const BOOLEAN_ORDER_KEYS = ["counterAttack", "offsideTrap", "timeWasting"] as const;

export function OrdersPanel({ clubId, orders }: OrdersPanelProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const saveMut = useSaveOrders(clubId);

  // Working (unsaved) copy — the server snapshot is adopted during render
  // (React's endorsed "adjust state on prop change" pattern; no effect needed).
  const saved = useMemo(() => normalizeOrders(orders), [orders]);
  const [draft, setDraft] = useState<ManagerOrders>(saved);
  const [synced, setSynced] = useState<ManagerOrders>(saved);
  if (saved !== synced) {
    setSynced(saved);
    setDraft(saved);
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync(draft);
      toast({ title: t("tactics.orders.saved"), description: t("tactics.orders.savedDesc") });
    } catch (e) {
      let description: string | undefined;
      if (e instanceof ApiError) description = `${e.code} — ${e.message}`;
      else if (e instanceof Error) description = e.message;
      toast({ title: t("common.error"), description, variant: "destructive" });
    }
  };

  return (
    <section aria-label={t("tactics.orders.title")} className="rounded-xl border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <SlidersHorizontal className="h-4 w-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">{t("tactics.orders.title")}</h2>
        {dirty && (
          <span
            role="status"
            aria-label={t("tactics.dirty.aria")}
            title={t("tactics.dirty.aria")}
            className="ml-auto h-2 w-2 rounded-full bg-amber-400"
          />
        )}
      </header>

      <div className="flex flex-col gap-3 px-3 py-3">
        {/* String orders */}
        {STRING_ORDER_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <Label
              htmlFor={`orders-${key}`}
              title={t(`tactics.orders.hint.${key}`)}
              className="text-[13px] text-foreground/90"
            >
              {t(`tactics.orders.${key}`)}
            </Label>
            <Select
              value={draft[key]}
              onValueChange={(v) =>
                setDraft((prev) => ({ ...prev, [key]: v }) as ManagerOrders)
              }
            >
              <SelectTrigger
                id={`orders-${key}`}
                aria-label={t(`tactics.orders.${key}`)}
                className="h-9 w-[132px] text-xs font-semibold text-amber-300"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANAGER_ORDERS_OPTIONS[key].map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">
                    {t(`tactics.orders.${key}.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        {/* Boolean orders */}
        {BOOLEAN_ORDER_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <Label
              htmlFor={`orders-${key}`}
              title={t(`tactics.orders.hint.${key}`)}
              className="text-[13px] text-foreground/90"
            >
              {t(`tactics.orders.${key}`)}
            </Label>
            <Switch
              id={`orders-${key}`}
              aria-label={t(`tactics.orders.${key}`)}
              checked={draft[key]}
              onCheckedChange={(v) => setDraft((prev) => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}

        <p className="text-[11px] leading-snug text-muted-foreground">{t("tactics.orders.hint")}</p>

        <Button
          onClick={handleSave}
          disabled={!dirty || saveMut.isPending}
          className={cn("min-h-[44px] w-full")}
        >
          {saveMut.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          {t("tactics.action.save")}
        </Button>
      </div>
    </section>
  );
}
