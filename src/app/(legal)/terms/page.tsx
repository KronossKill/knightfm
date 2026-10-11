import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Términos y Condiciones de Uso",
  description:
    "Reglas de uso de Knight FM: registro, economía $Knight en Solana, propiedad intelectual, pagos y reembolsos, limitación de responsabilidad y ley aplicable.",
  alternates: { canonical: "/terms" },
};

export default async function TermsPage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("terminos-condiciones.md", locale)} />;
}
