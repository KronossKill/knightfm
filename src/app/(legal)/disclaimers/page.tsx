import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Descargos de Responsabilidad",
  description:
    "Descargos de Knight FM: servicio tal cual, riesgo del token $Knight y criptoactivos, juego responsable, IA, contenido del usuario y límites legales.",
  alternates: { canonical: "/disclaimers" },
};

export default async function DisclaimersPage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("descargos-responsabilidad.md", locale)} />;
}
