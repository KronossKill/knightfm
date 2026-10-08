"use client";
// Section 8 — Knight Assistant: premium contextual AI that explains rules/state
// and can NEVER execute market/financial/ownership actions (hard guarantee),
// with a static illustrative chat built on real rule facts.

import { Bot, ShieldCheck, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Reveal } from "../reveal";
import { SectionHeader } from "../section-header";
import { SectionTracker } from "../analytics-tracker";
import { EV } from "../analytics";

export function KnightAssistant() {
  const { t } = useI18n();

  const conversation = [
    { user: t("landing.assistant.u1"), bot: t("landing.assistant.a1") },
    { user: t("landing.assistant.u2"), bot: t("landing.assistant.a2") },
    { user: t("landing.assistant.u3"), bot: t("landing.assistant.a3") },
  ];

  return (
    <SectionTracker
      event={EV.assistantView}
      id="assistant"
      labelledBy="assistant-title"
      className="border-t border-border/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader
          kickerKey="landing.assistant.kicker"
          titleKey="landing.assistant.title"
          subtitleKey="landing.assistant.subtitle"
          headingId="assistant-title"
        />

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          {/* Hard guarantee */}
          <Reveal>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
              <div className="flex items-start gap-3">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
                <div>
                  <h3 className="text-lg font-semibold">{t("landing.assistant.guaranteeTitle")}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{t("landing.assistant.guarantee")}</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Static mock conversation */}
          <Reveal delay={0.1}>
            <Card>
              <CardContent className="pt-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t("landing.assistant.chatLabel")}
                </p>
                <div className="space-y-4" aria-label={t("landing.assistant.chatLabel")}>
                  {conversation.map((turn, i) => (
                    <div key={i} className="space-y-3">
                      {/* User bubble */}
                      <div className="flex items-end justify-end gap-2">
                        <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                          {turn.user}
                        </p>
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full border bg-card"
                        >
                          <User className="size-3.5 text-muted-foreground" />
                        </span>
                      </div>
                      {/* Assistant bubble */}
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/30 bg-primary/10"
                        >
                          <Bot className="size-4 text-primary" />
                        </span>
                        <p className="max-w-[85%] rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
                          {turn.bot}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-5 flex items-center gap-1.5 border-t pt-4 text-xs text-muted-foreground">
                  <Bot aria-hidden="true" className="size-3.5" />
                  {t("landing.assistant.illustrative")}
                </p>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </SectionTracker>
  );
}
