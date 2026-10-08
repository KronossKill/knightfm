# 01 — Arquitectura

## Stack tecnológico (no negociable)

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) + **TypeScript 5** estricto |
| UI | React 19, **Tailwind CSS 4**, **shadcn/ui** (estilo New York), Lucide Icons, Framer Motion |
| Estado | **Zustand** (cliente) + **TanStack Query** (servidor) |
| Base de datos | **SQLite** vía **Prisma ORM 6** (`db/custom.db`) |
| Autenticación | JWT propio (`jose`) — access 15 min + refresh rotativo opaco en DB, hash **argon2id** (`@node-rs/argon2`) |
| Email | Nodemailer (Brevo SMTP) + código de verificación on-premise de respaldo |
| Blockchain | Solana (bs58, verificación de transferencias on-chain para depósitos) |
| IA | z-ai-web-dev-sdk (asistente Caballero, solo backend) |
| i18n | Diccionarios propios es/en/fr/pt ×8 namespaces (landing, auth, game, markets, tactics, admincfg, vpnpol, lifecycle, common) |

## Estructura de carpetas

```
src/
├── app/
│   ├── page.tsx                  # Única ruta de página (/) — landing + juego
│   ├── layout.tsx / globals.css  # Shell, temas (knight-emerald + 4 más)
│   ├── sitemap.ts / robots.ts / manifest.ts   # SEO
│   └── api/                      # ~70 endpoints REST (ver 03-api.md)
├── components/
│   ├── auth/       AuthFlow (login/registro/verificación), store.ts (Zustand + apiFetch)
│   ├── landing/    12 secciones públicas + tracker de analítica
│   ├── game/       shell.tsx, app-root.tsx + vistas: dashboard, squad, tactics,
│   │               training, youth, staff, facilities, markets, treasury, wallet,
│   │               competitions, inbox, settings, assistant, control-center/
│   ├── onboarding/ Elección Mánager/Propietario + compra de club
│   └── ui/         Kit shadcn/ui completo
├── hooks/          use-heartbeat (presencia), use-mobile, use-toast
├── lib/
│   ├── api.ts      ok()/fail(), requireAuth, audit, clientIp, gates de mantenimiento
│   ├── auth.ts     Emisión/rotación de tokens, hash argon2id
│   ├── config.ts   113 claves CONFIG_DEFAULTS (ver 04-configuracion.md)
│   ├── genesis.ts  Wipe + reseed del mundo (usado por CLI y /api/admin/reset)
│   ├── db.ts       Cliente Prisma singleton
│   ├── security.ts Headers, rate limit, sanitización
│   ├── vpn.ts      Detector VPN/proxy + CIDR + excepciones
│   ├── security/ip-guard.ts  Anti-multicuenta (Task 41/42)
│   ├── engine/     kmie, matches, fixtures, finance, prizes, training, ovr,
│   │               tactics, aging, capacity, promotions, scheduler, clock,
│   │               inactivity, club-baseline, names, knight-usd
│   └── i18n/       Provider + diccionarios ×4 idiomas
└── middleware.ts   Perímetro: security headers + rate limit global
```

## El reloj del mundo (UTC server-authoritative)

- `world.epoch.utc` (SystemState) fija el instante de la génesis; **GameDay = 1 + floor((UTCnow − epoch) / 24h)**.
- El cliente NUNCA envía fechas: todas las jornadas, kickoffs, salarios y edades se derivan del reloj del servidor.
- Los cumpleaños envejecen cada 30 días reales, anclados al día en que cada persona apareció por primera vez.

## Scheduler diario (JobRun como ledger de idempotencia)

Un tick (`/api/scheduler/tick`, también invocable por cron) ejecuta los trabajos del día actual y recupera días perdidos:

| Job | Cadencia | Función |
|---|---|---|
| `INACTIVITY` | diario | 40 días sin acceso → INACTIVE; 60 → hard-delete con reversión del club al sistema |
| `SALARY` | semanal (7 días) | Nóminas de jugadores y staff, con fondos del club |
| `ROLLOVER` | diario | Cierre de partidos del día, fatiga/forma, envejecimiento, mercado |
| `FIXTURES/MATCHES` | por kickoff (19:00 UTC, escalonado 90 min por región ±20 min) | Simulación KMIE |
| `SEASON` | día 32 competitivo | Ascensos/descensos 3↑/3↓, Mundial (desde T2), nueva temporada |

Cada trabajo registra su clave (`SALARY:7`, `ROLLOVER:12`…) en `JobRun`; repetir el tick del mismo día es un no-op.

## Calendario de temporada (configurable)

```
Días 1–5      Pretemporada (mínimo garantizado tras un reset)
Días 1–28     Liga (ida y vuelta, 16 clubes/división)
Día 28        Liga completa · Día 29 final de Copa regional · Día 30 final del Mundial
Día 30        Cierre: premios, ascensos/descensos, prize pools
Días 31–32    Transición → nueva temporada
```

- **Mundial de Clubes**: solo desde la **Temporada 2** (en T1 no existen clasificados). Clasifican el top-3 de cada 1ª división regional + el campeón de copa regional (si ya clasificó, entra el 4º de esa 1ª división).
- **Ascensos/descensos**: 3 suben / 3 bajan entre divisiones contiguas (la 10ª no baja, la 1ª no sube).

## Motor KMIE (simulación causal)

`lib/engine/kmie.ts` + `matches.ts` simulan cada partido con: atributos técnicos/físicos/mentales por jugador, forma/fatiga/frescura/moral/confianza, táctica (formación, estilo, presión, agresividad — Tablero Táctico interactivo), localía, portero y rachas. Eventos: goles, amarillas (máx. 4, 5 → suspensión), rojas (5% prob., 2 partidos de suspensión), lesiones según Ciencia Deportiva.

## Génesis y reset del mundo

`lib/genesis.ts`:
- `runWorldGenesis({wipe})` — destruye (FK-safe, hijos primero) y reconstruye: config, knowledge base, admin, 10×10×16 clubes con instalaciones nivel 1 y SIN staff (mandato: el cuerpo técnico se contrata con los fondos del club), plantillas de 20 jugadores con atributos por-OVR, 40 agentes libres, fixtures de liga+copa anclados al día futuro de inicio de temporada.
- El reset es **backup → wipe → reseed** (dos pasos con token de confirmación desde el Centro de Control); preserva usuarios, wallets, config, auditoría, depósitos/retiros, notificaciones y mensajes. Cero historial de partidos tras el reset (mandato del usuario).
- `world.seasonStartOffsetDays` (mín. 5) separa el reset del día 1 competitivo.
