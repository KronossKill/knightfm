# 05 — DEPENDENCY REPORT (Fase 5, Task 94)

**Política:** «latest stable» con cero riesgos silenciosos — minors/patches sí,
majors UNA por ciclo con E2E completo (Master Prompt Unificado §dependencies).

## 1. Aplicadas en este ciclo (package.json 3-oct → v9.0.0)

**83 declaraciones actualizadas: 40 minor + 22 patch + 21 anclajes (^→exacto).
0 majors.** Lock regenerado (`bun.lock`, 650 líneas) e instalado verificado
(`node_modules/next` = 16.4.0).

### Headliners
| Paquete | Antes | Ahora | Tipo |
|---|---|---|---|
| **next** | 16.1.3 exacto | **16.4.0 exacto** (ADR-001) | minor |
| react / react-dom | ^19.0.0 | 19.3.0 | minor |
| prisma / @prisma/client | ^6.11.1 | 6.19.3 | minor |
| eslint-config-next | ^16.1.1 | 16.4.0 | minor |
| typescript | ^5 | 5.9.3 | ancla+minor |
| tailwindcss / @tailwindcss/postcss | ^4 | 4.3.3 | ancla+minor |

### Resto de minors (35)
@hookform/resolvers 5.9.1 · @mdxeditor/editor 3.55.0 · 11× @radix-ui (1.1.x→1.2.x / 1.2.x) ·
@reactuses/core 6.5.9 · @tanstack/react-query 5.104.1 · date-fns 4.4.0 · docx 9.10.0 ·
framer-motion 12.43.0 · input-otp 1.5.0 · next-intl 4.14.9 · nodemailer 10.1.0 ·
react-day-picker 9.14.0 · react-hook-form 7.90.0 · tailwind-merge 3.7.0 · zod 4.6.5 ·
@types/react(-dom) 19.3.0 · bun-types 1.4.3 · eslint 9.39.5 · tw-animate-css 1.4.0 …

### Patches (22)
@node-rs/argon2 2.2.2 · 13× @radix-ui patch · react-resizable-panels 3.0.6 ·
react-syntax-highlighter 15.6.6 · sharp 0.34.5 · sonner 2.0.8 · uuid 11.1.1 ·
zustand 5.0.15 …

### Anclajes sin cambio de versión (21)
@dnd-kit/* · @tanstack/react-table · bs58 · clsx · cmdk · cva · flag-icons ·
lucide-react · qrcode.react · recharts · remark-gfm · z-ai-web-dev-sdk …

## 2. Verificación post-actualización

- `bun install` OK · dev server **Next 16.4.0 (Turbopack)** Ready (dev.log) ·
  GET / 200 · `bun run lint` → verde con `set-state-in-effect` warn (8 sitios
  preexistentes, plan de refactor en CHANGELOG/STATE) · 0 errores de consola en
  E2E del panel de descargas.
- Aviso known-issue NO bloqueante de Next 16.4: deprecación `middleware` →
  `proxy` (el proyecto ya usa `proxy.ts`; el warning sale por el archivo legacy
  y desaparecerá al completar la migración con el codemod oficial).

## 3. Disponibles y APLAZADAS (14) — plan «una major por ciclo»

| Paquete | Actual | Latest | Nota de migración |
|---|---|---|---|
| @mdxeditor/editor | 3.55.0 | 4.3.2 | API de plugins cambia |
| @prisma/client + prisma | 6.19.3 | 7.10.0 (estable) | driver adapters; requerirá migrar schema y env |
| @tanstack/react-table | 8.21.3 | 9.2.8 | API de columnas |
| framer-motion | 12.43.0 | 14.1.0 | imports `motion/react` |
| lucide-react | 0.525.0 | 1.55.0 | 1.0 = primera estable; revisar iconos borrados |
| react-day-picker | 9.14.0 | 10.0.2 | estilos del calendario |
| react-resizable-panels | 3.0.6 | 4.14.4 | API de layouts |
| react-syntax-highlighter | 15.6.6 | 16.1.2 | types |
| recharts | 2.15.4 | 3.10.1 | API de charts (widgets finance/standings) |
| sharp | 0.34.5 | 0.35.5 | minor; peer de next 16.4 (^0.35) — baja prioridad |
| uuid | 11.1.1 | 14.0.3 | ESM puro |
| eslint (dev) | 9.39.5 | 10.12.0 | plugins |
| typescript (dev) | 5.9.3 | 7.0.2 | línea estable — esperar madurez del ecosistema |

**Justificación del aplazamiento:** una entrega nunca debe meter 14 majors de
golpe (riesgo de regresión masiva, exactamente lo que el mandato prohíbe).
Cada una irá en su propio ciclo con E2E completo (el mecanismo KFM-OPS-015
garantiza que nada defectuoso se publica).

## 4. Vulnerabilidades

- `bun outdated` = única desviación relevante son las 14 majors (sin advisories
  activos que afecten a las versiones fijadas del stack de ejecución).
- El paquete entregado fija TODO exacto (sin ^) → el `npm install` del usuario
  reproduce el árbol verificado byte a byte.
- Recomendación opcional al usuario (no bloquea): `npm audit` informativo tras
  instalar; cualquier finding real se atiende en el ciclo siguiente.
