import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Aviso Legal",
  description:
    "Identificación del titular de Knight FM y condiciones generales de uso conforme a la LSSI-CE: objeto, propiedad intelectual, responsabilidad y contacto.",
  alternates: { canonical: "/legal-notice" },
};

export default async function LegalNoticePage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("aviso-legal.md", locale)} />;
}
