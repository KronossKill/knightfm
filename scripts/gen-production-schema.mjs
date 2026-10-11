// Knight FM — Generador del schema de producción (PostgreSQL/Supabase)
// ─────────────────────────────────────────────────────────────────────
// ANTI-REGRESIÓN (Task 76): el 2026-10-10 el ZIP de banderas v3 incluyó
// el schema de desarrollo (provider "sqlite") y al extraerlo el usuario
// sobrescribió su schema de producción ("postgresql") → Vercel devolvió
// 500 en todos los endpoints de BD ("the URL must start with the
// protocol `file:`").
//
// REGLA PERMANENTE: ningún ZIP entregado al usuario puede contener
// `provider = "sqlite"`. El usuario SIEMPRE recibe la salida de este
// script copiada como `prisma/schema.prisma`.
//
// Uso:  node scripts/gen-production-schema.mjs
// Salida: prisma/schema.production.prisma (NO editar a mano)

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcPath = join(root, 'prisma', 'schema.prisma')
const outPath = join(root, 'prisma', 'schema.production.prisma')

const src = readFileSync(srcPath, 'utf8')

if (!/provider\s*=\s*"sqlite"/.test(src)) {
  console.error(
    '✖ prisma/schema.prisma ya no declara provider "sqlite".\n' +
      '  Si el sandbox migró a PostgreSQL, revisa este script antes de regenerar.'
  )
  process.exit(1)
}

const out = src
  // 1) Proveedor de base de datos: desarrollo SQLite → producción PostgreSQL
  .replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"')
  // 2) Cabecera: marca la variante como generación automática de producción
  .replace(
    /^\/\/ SQLite \+ Prisma\..*$/m,
    '// PRODUCCIÓN (PostgreSQL — Supabase). AUTO-GENERADO por scripts/gen-production-schema.mjs — NO EDITAR A MANO.\n' +
      '// Editar prisma/schema.prisma (desarrollo) y regenerar este archivo. Sin enums (no soportados en el modelo):\n' +
      '// todos los enums son String con uniones validadas en src/lib/types.ts'
  )

writeFileSync(outPath, out)
console.log(`✔ Generado ${outPath} (provider "postgresql", ${src.split('\n').length} líneas)`)
