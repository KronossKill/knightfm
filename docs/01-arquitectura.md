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
│   ├── config.ts   123 claves CONFIG_DEFAULTS (ver 04-configuracion.md)
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

## Motor TRAMA (Tejido de Reacciones, Azar y Momentos Adaptativos — Task 101)

Implementación del spec propio del proyecto ("Parte 3 · Motor de partido TRAMA", subida por el usuario). El partido es un tejido de **5 hilos** (Mundo, Cuerpo, Mente, Juego, Azar) cuyas tensiones se cruzan en **nudos** resueltos en 5 pasos:

```
RE = Calidad × Fcuerpo × Fmente × Fmundo × Frol × Fsinergia × Fexp   (cada F ∈ 0.60–1.15)
M  = (RE_atacante − RE_defensor) + Espacio + Táctica + Marea
P  = 1 / (1 + e^(−M/T))     con T = 3 × (1 + Caos de contexto), caos 0–1.5
Banda: Excelente / Correcto / Forzado / Fallo / Error / Desastre  (colas pesadas)
```

| Hilo | Qué modela aquí |
|---|---|
| Mundo | clima evolutivo (frentes cambian en el descanso/tramo final), terreno por zonas con desgaste→barro según lluvia, reparación del descanso (10-20% según estadio), afición (estadio), árbitro con severidad+consistencia |
| Cuerpo | depósitos aeróbico/anaeróbico/mental con curva no lineal (>70% libre, 70-40 gradual, <40 fuerte, <15 calambres); lesiones R = R0 × Fatiga^1.5 × Terreno × Frío × (1−Protección médica) |
| Mente | ánimo reaccionando a goles/errores, lapsus post-gol (3 min) agravados por plantilla joven, concentración que se agota con presión |
| Juego | cadenas de posesión con 4 puertas (construcción→progresión→creación→finalización), lectura adaptativa de rutas (−12% si repites), marea del partido (−1..1 con inercia 0.93), gestión del marcador progresiva (0.88–1.08), estilos Con/Sin balón como términos Táctica/Espacio |
| Azar | temperatura de azar variable por nudo, día de forma oculto (±8%, colas pesadas), cisnes negros (fallo de focos, objetos, invasión) con **presupuesto de caos** (4 extremos por partido, efecto acotado), rebotes y segundas jugadas |

**Experiencia (3.15)**: Madurez = 1/(1+e^(−(edad−22)/3)) por edad real; Bagaje = 100×(1−e^(−PE/200)) con proxy determinista de carrera (PE=(edad−17)×26); Fexp = 1 + pesoNudo×(expEfectiva − exigencia) acotado [0.85, 1.04]; Colas = 1.35 − 0.5×Madurez (los jóvenes viven más extremos); Serenidad amortigua nervios.

**Equidad (3.11)**: ventaja local = factores reales (sin viaje + afición) **con tope configurable (3%)**; reglas idénticas para ambos; determinismo auditable desde la semilla.

**Calibración (3.13)** — `bun scripts/calibrate-trama.ts 12000`: 2.58 goles, 9.6 tiros/equipo, 3.8 córners, 23.1 faltas, 3.85 amarillas, 0.09 rojas, 0.25 penaltis, 46.7/20.6/32.7% 1X2, 0.32 ms/partido. Dominancia táctica máx. 49.8% (<58%) y simetría <3% verificadas.

Los informes guardan las **causas** de cada gol (3.12): "CLIMA +0.20 · TERRENO +0.18" en el detalle del evento. Toggle: `trama.enabled` (false → camino Poisson legado). Simplificaciones documentadas: pulsos→cadenas, malla 24×16→3 zonas, sinergia por pares→equipo, PE real→proxy por edad (fase 2 del roadmap).

## Génesis y reset del mundo

`lib/genesis.ts`:
- `runWorldGenesis({wipe})` — destruye (FK-safe, hijos primero) y reconstruye: config, knowledge base, admin, 10×10×16 clubes con instalaciones nivel 1 y SIN staff (mandato: el cuerpo técnico se contrata con los fondos del club), plantillas de 20 jugadores con atributos por-OVR, 40 agentes libres, fixtures de liga+copa anclados al día futuro de inicio de temporada.
- El reset es **backup → wipe → reseed** (dos pasos con token de confirmación desde el Centro de Control); preserva usuarios, wallets, config, auditoría, depósitos/retiros, notificaciones y mensajes. Cero historial de partidos tras el reset (mandato del usuario).
- `world.seasonStartOffsetDays` (mín. 5) separa el reset del día 1 competitivo.
