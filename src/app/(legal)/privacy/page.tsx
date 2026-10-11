import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Cómo Knight FM recopila, usa y protege tus datos (RGPD/LOPDGDD/CCPA): cuenta, wallet de Solana, seguridad, analítica opcional y tus derechos.",
  alternates: { canonical: "/privacy" },
};

export default async function PrivacyPage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("politica-privacidad.md", locale)} />;
}
