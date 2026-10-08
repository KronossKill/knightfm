# Knight FM — Documentación completa

**Knight FM** es el mánager de fútbol online persistente: un mundo que vive 24/7 en UTC, 10 regiones × 10 divisiones × 16 clubes (1.600 clubes, 32.000 jugadores), economía $Knight con puente a Solana, mercados completos (subastas, venta directa, cláusulas, cesiones, agentes libres, ofertas a mánagers) y un motor de simulación causal (KMIE) sin progresión manual.

- **Idioma principal**: Español (con diccionarios completos en EN/FR/PT)
- **Reloj del mundo**: UTC server-authoritative — el avance del juego no puede ser manipulado por el cliente
- **Cuentas de administrador**: se configuran vía variables de entorno `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — nunca en el código ni en documentación pública

---

## Índice de documentos

| Documento | Contenido |
|---|---|
| [01-arquitectura.md](01-arquitectura.md) | Stack tecnológico, estructura de carpetas, motor KMIE, scheduler diario, calendario de temporada |
| [02-base-de-datos.md](02-base-de-datos.md) | Modelos Prisma (SQLite), relaciones clave, evidencia anti-multicuenta |
| [03-api.md](03-api.md) | Referencia de los ~70 endpoints REST (auth, juego, mercados, admin) |
| [04-configuracion.md](04-configuracion.md) | Las 113 claves de configuración editables desde el Centro de Control, con valores por defecto |
| [05-seguridad.md](05-seguridad.md) | Autenticación JWT, argon2id, lockout, captcha, regla 1 cuenta/IP, bloqueo 30 días, VPN, pentest |
| [06-guia-administrador.md](06-guia-administrador.md) | Cuentas admin, Centro de Control pestaña por pestaña, reset del mundo, moderación |
| [07-economia.md](07-economia.md) | $Knight, gravámenes, salarios semanales, mercados de pases, depósitos/retiros Solana |
| [08-competencia.md](08-competencia.md) | Comparativa con los competidores más potentes del sector (ganador/perdedor) |
| [09-changelog.md](09-changelog.md) | Historial completo de las 45 tareas de desarrollo |
| [10-despliegue-github-supabase.md](10-despliegue-github-supabase.md) | **Guía de despliegue**: subir el proyecto a GitHub y migrar la base de datos a Supabase (PostgreSQL), paso a paso desde Windows |

---

## Arranque rápido

```bash
# Requisitos: Node 20+ o Bun, SQLite incluido
bun install                # o npm install
bun run db:push            # crea el schema en db/custom.db
bun run dev                # servidor en http://localhost:3000

# ¿Producción con GitHub + Supabase (PostgreSQL)? Ver docs/10-despliegue-github-supabase.md
```

El mundo se genera automáticamente al primer arranque (genesis): 10 regiones, 100 divisiones, 1.600 clubes con 20 jugadores cada uno, 40 agentes libres, calendario de liga y copa, y la cuenta de administrador definida en `ADMIN_BOOTSTRAP_EMAIL` (con la contraseña de `ADMIN_BOOTSTRAP_PASSWORD` — cámbiala tras el primer login).

## Scripts npm

| Script | Acción |
|---|---|
| `bun run dev` | Servidor de desarrollo (puerto 3000, log en dev.log) |
| `bun run lint` | ESLint |
| `bun run db:push` | Sincroniza `prisma/schema.prisma` con la base de datos |
| `bun run db:generate` | Regenera el cliente Prisma |
| `bun run build` / `start` | Build de producción standalone |

## Estructura mínima

```
src/
  app/api/            ~70 endpoints REST (Next.js App Router)
  components/game/    Vistas del juego (dashboard, tácticas, mercados, etc.)
  components/auth/    Login/registro/2FA + store Zustand
  components/landing/ Landing pública (12 secciones)
  lib/engine/         Motor del juego (KMIE, fixtures, finanzas, entrenamiento…)
  lib/security/       ip-guard (anti-multicuenta)
  lib/i18n/dict/      Diccionarios es/en/fr/pt ×8 namespaces
prisma/schema.prisma  50+ modelos
docs/                 Esta documentación
```
