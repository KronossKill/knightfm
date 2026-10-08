// Ensamblaje final del documento Word — Knight FM Documentación Técnica
// 3 secciones: portada (sin numerar) / índice (romano) / cuerpo (arábigo desde 1)
import {
  Document, Packer, Paragraph, TextRun, Header, Footer, PageNumber, NumberFormat,
  SectionType, AlignmentType, TableOfContents, LevelFormat, fs,
  PAL, HEADING_COLOR, BODY_FONT,
  buildCoverR1,
} from "./docx-lib.js";
import { cap1, cap2, cap3, cap4, cap5 } from "./docx-content1.js";
import { cap6, cap7, cap8, cap9, cap10 } from "./docx-content2.js";

const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const pageNumFooter = () => new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: BODY_FONT })],
  })],
});
const docHeader = () => new Header({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: "single", size: 2, color: PAL.table.innerLine, space: 4 } },
    children: [new TextRun({ text: "Knight FM — Documentación técnica", size: 16, color: "999999", font: BODY_FONT })],
  })],
});

// Numeraciones (cada lista con reference única)
const numberingConfig = ["admin-access", "wins", "losses"].map((ref) => ({
  reference: ref,
  levels: [{
    level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720, hanging: 360 } } },
  }],
}));

const doc = new Document({
  creator: "Knight FM",
  title: "Knight FM — Documentación técnica completa",
  description: "Arquitectura, API, seguridad, economía y guía de administrador del mánager de fútbol online persistente",
  styles: {
    default: {
      document: {
        run: { font: BODY_FONT, size: 24, color: "000000" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: BODY_FONT, size: 32, bold: true, color: HEADING_COLOR },
        paragraph: { spacing: { before: 360, after: 200, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: BODY_FONT, size: 28, bold: true, color: HEADING_COLOR },
        paragraph: { spacing: { before: 280, after: 140, line: 312 }, outlineLevel: 1 },
      },
      heading3: {
        run: { font: BODY_FONT, size: 24, bold: true, color: "1A1A1A" },
        paragraph: { spacing: { before: 220, after: 100, line: 312 }, outlineLevel: 2 },
      },
    },
  },
  numbering: { config: numberingConfig },
  sections: [
    // ── Sección 1: Portada (margen 0, sin numeración ni footer) ──
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        palette: PAL,
        englishLabel: "TECHNICAL DOCUMENTATION",
        title: "Knight FM",
        subtitle: "Documentación técnica completa · El mánager de fútbol online persistente",
        metaLines: [
          "Versión 1.0 · Septiembre 2026",
          "Stack: Next.js 16 · TypeScript 5 · Prisma 6 / SQLite · Solana",
          "Administradores: configurados vía ADMIN_BOOTSTRAP_EMAIL (variable de entorno)",
          "45 tareas de desarrollo documentadas · 113 claves de configuración",
        ],
        footerLeft: "KNIGHT FM",
        footerRight: "docs/ · ZIP descargable desde la landing",
      }),
    },
    // ── Sección 2: Índice (números romanos) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Índice", bold: true, size: 32, font: BODY_FONT, color: "000000" })],
        }),
        new TableOfContents("Tabla de contenido", { hyperlink: true, headingStyleRange: "1-3" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Nota: este índice se genera mediante códigos de campo. Tras editar el documento, haga clic derecho sobre el índice y elija «Actualizar campos» para refrescar los números de página.",
            italics: true, size: 18, color: "888888", font: BODY_FONT,
          })],
        }),
      ],
    },
    // ── Sección 3: Cuerpo (números arábigos desde 1) ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: [...cap1, ...cap2, ...cap3, ...cap4, ...cap5, ...cap6, ...cap7, ...cap8, ...cap9, ...cap10],
    },
  ],
});

const OUT = "/home/z/my-project/public/downloads/knight-fm-documentacion.docx";
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log("OK ->", OUT, buf.length, "bytes");
}).catch((e) => { console.error("FAIL:", e); process.exit(1); });
