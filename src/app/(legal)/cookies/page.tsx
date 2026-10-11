import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description:
    "Cookies y almacenamiento local que usa Knight FM: técnicos esenciales, preferencias y analítica propia opcional sujeta a tu consentimiento.",
  alternates: { canonical: "/cookies" },
};

export default async function CookiesPage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("politica-cookies.md", locale)} />;
}
