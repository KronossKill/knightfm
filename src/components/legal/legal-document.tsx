// Knight FM — renderizador de documentos legales en Markdown (LEGAL, Task 51).
// Server component: react-markdown funciona en RSC sin estado. Los encabezados
// reciben ids con slug normalizado (sin acentos, sin numeración inicial) para
// que los enlaces del footer (#juego-responsable, #pagos-y-reembolsos…)
// apunten a las secciones exactas.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** "2. Riesgo del token" → "riesgo-del-token" (normaliza acentos y numeración). */
export function slugifyHeading(text: string): string {
  const clean = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^\s*\d+(\.\d+)*\.?\s*/, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return clean;
}

export function LegalDocument({ content }: { content: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <article className="legal-doc text-sm leading-relaxed [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_blockquote]:my-4 [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-4 [&_blockquote]:border-amber-500/60 [&_blockquote]:bg-amber-500/10 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-xs [&_blockquote]:leading-relaxed [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mt-2 [&_h1]:text-balance [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h2]:mt-10 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-border/60 [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:scroll-mt-24 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:my-8 [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-semibold [&_table]:my-4 [&_table]:w-full [&_table]:text-xs [&_td]:border [&_td]:border-border/60 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:border-border/60 [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_thead]:text-muted-foreground [&_tbody_tr:nth-child(even)]:bg-muted/30 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => <h1>{children}</h1>,
            h2: ({ children }) => (
              <h2 id={slugifyHeading(String(children))}>{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 id={slugifyHeading(String(children))}>{children}</h3>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
