# ⚽ Knight FM

**El mánager de fútbol online persistente.** Un mundo que vive 24/7 en UTC: 10 regiones ×
10 divisiones × 16 clubes (1.600 clubes, 32.000 jugadores), economía **$Knight** con puente
a **Solana**, mercados completos (subastas, venta directa, cláusulas, cesiones, agentes
libres) y un motor de simulación causal (**KMIE**) sin progresión manual.

- 🌍 Mundo persistente con reloj *server-authoritative* (no manipulable por el cliente)
- 💰 Economía con gravámenes, salarios, patrocinios y depósitos/retiros en Solana
- 🛡️ Seguridad: argon2id, JWT, captcha, 1 cuenta por IP, anti-multicuenta de 30 días, auditoría
- 🌐 4 idiomas completos: Español · English · Français · Português

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui |
| Backend | ~70 endpoints REST (App Router) · motor KMIE propio |
| Base de datos | Prisma 6 · **SQLite** (dev) / **PostgreSQL (Supabase)** (producción) |
| Cripto | Solana mainnet · moneda $Knight |

## Arranque rápido

```bash
# 1) Copia la plantilla de entorno y rellénala
copy .env.example .env          # (Windows)  ·  cp .env.example .env (macOS/Linux)

# 2) Instala y crea el esquema
npm install                     # o: bun install
npx prisma db push              # o: bun run db:push

# 3) Arranca
npm run dev                     # o: bun run dev → http://localhost:3000
```

El mundo (genesis) se genera automáticamente al primer arranque. La cuenta admin se crea
con `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` de tu `.env` — **cambia la
contraseña tras el primer login**.

## 📦 Despliegue: GitHub + Supabase + Vercel

Guía completa, exacta y en español, paso a paso desde Windows:
**[`docs/10-despliegue-github-supabase.md`](docs/10-despliegue-github-supabase.md)**
(GitHub → Supabase → Vercel, con solución de errores comunes incluida).

## Documentación

Toda la documentación técnica vive en [`docs/`](docs/README.md):
arquitectura, base de datos, referencia API (~70 endpoints), 113 claves de configuración,
seguridad, guía del administrador, economía, análisis competitivo y changelog.
