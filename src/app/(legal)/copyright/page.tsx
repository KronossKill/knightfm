import type { Metadata } from "next";
import { getLegalLocale, readLegalDoc } from "@/lib/legal";
import { LegalDocument } from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Copyright y DMCA",
  description:
    "Aviso de copyright de Knight FM y procedimiento DMCA: notificación de infracción, contranotificación, política de reincidentes y agente designado.",
  alternates: { canonical: "/copyright" },
};

export default async function CopyrightPage() {
  const locale = await getLegalLocale();
  return <LegalDocument content={readLegalDoc("copyright-dmca.md", locale)} />;
}
