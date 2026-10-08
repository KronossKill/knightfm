# 03 — Referencia de API

Todas las rutas son `/api/*`, JSON, con envelope uniforme:

```jsonc
// Éxito
{ "ok": true, "data": { ... } }
// Error
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "extra": { } } }
```

- **Autenticación**: header `Authorization: Bearer <accessToken>` (JWT 15 min).
- **Autorización**: `requireAuth` valida token + existencia del usuario + estado (BLOCKED → 403 `ACCOUNT_BLOCKED` en TODAS las rutas) + modo mantenimiento (solo ADMIN operan).
- **Erres comunes**: 401 `UNAUTHORIZED`, 403 `FORBIDDEN`/`ACCOUNT_BLOCKED`/`VPN_BLOCKED`, 429 rate-limit perimetral, 400 `VALIDATION_ERROR` (zod).

## Autenticación (`/api/auth`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/register` | POST | Registro (email, username, password, path, captcha). Vende `IpLink`, aplica regla 1-cuenta/IP y bloqueo 30 días ANTES de emitir sesión. Emails en `admin.bootstrapEmail` nacen ADMIN (sin sellar IP) |
| `/login` | POST | Login con captcha + lockout (5 intentos/15 min). Detecta IP multicuenta antes de emitir sesión. 403 `ACCOUNT_BLOCKED` con `extra.reason` si está bloqueada |
| `/refresh` | POST | Rotación de refresh token; relee `role`/`status` de la DB |
| `/logout` | POST | Revoca la sesión actual |
| `/me` | GET | Perfil + wallet + clubes poseídos/gerenciados |
| `/verify-email` | POST | Código de 6 dígitos |
| `/resend-verification` | POST | Reenvío con throttle |
| `/password-reset/request` | POST | Token al correo (nunca revela si el email existe) |
| `/password-reset/confirm` | POST | Token + nueva contraseña; revoca todas las sesiones |

## Juego — club y jugadores

| Endpoint | Método | Descripción |
|---|---|---|
| `/club/mine` | GET | Club activo (propietario o mánager) |
| `/club/[id]` | GET | Detalle público de cualquier club (plantilla, instalaciones, brand) |
| `/club/brand` | PATCH | Personalizar nombre, escudo (forma+patrón) y colores (propietario) |
| `/club/release` · `/club/resign` | POST | Vender club al sistema (90%) · renunciar a la gerencia |
| `/players` · `/players/[id]` | GET | Plantilla / perfil con atributos y tendencia de valor |
| `/players/[id]/release` | POST | Rescisión (paga días restantes de contrato → SYSTEM) |
| `/players/[id]/clause` | POST | Pagar cláusula de otro club |
| `/tactics` · `/tactics/auto` | GET/PUT · POST | Guardar alineación / auto-completar |
| `/training` | GET/POST | Sesiones (general 1/día, específica 1/tipo/día) con desglose multi-factor |
| `/youth/scout` · `/youth/prospects[/id]` · `/youth/promote` | GET/POST | Ojear (revela = estrellas del ojeador), cantera, ascender a 18 años |
| `/staff` · `/staff/candidates` · `/staff/hire` · `/staff/release` | GET/POST | Cuerpo técnico por estrellas (1★→3$…5★→40$/día) |
| `/facilities` · `/facilities/upgrade` | GET/POST | Instalaciones nivel 1–10 |
| `/treasury` · `/treasury/invest` · `/treasury/withdraw` | GET/POST | Tesorería del club; invertir sin gravamen; retirar con 10% |
| `/competitions/fixtures` · `/standings` · `/cups` · `/worldcup` · `/match/[id]` · `/friendly` | GET/POST | Competiciones, bracket visual, detalle de partido, amistosos |

## Mercados (`/api/markets`)

| Endpoint | Descripción |
|---|---|
| `/auctions` + `/create` + `/[id]/bid` | Subastas de jugadores con puja mínima (floor 20%) |
| `/direct/list` + `/[id]/buy` | Venta directa (floor 100%) |
| `/release-clause` | Lista de cláusulas ejercibles de otros clubes |
| `/free-agents` + `/[id]/sign` | Pool rotativo 24h (40 jugadores) |
| `/loan/create` + `/[id]/take` + `/[id]/cancel` · `/loans` | Cesiones: SIEMPRE duran hasta el final de la temporada |
| `/manager-offers` + `/[id]/apply` | Ofertas de clubes del sistema a mánagers sin club |
| `/clubs/sale` + `/buy` | Venta de clubes propietario-a-propietario |

## Usuario y mundo

| Endpoint | Descripción |
|---|---|
| `/wallet` · `/wallet/deposit` · `/wallet/withdraw` · `/wallet/price` | Cartera $Knight: depósito Solana verificado on-chain (SIN gravamen), retiro (levy 10%, mínimo configurable), precio en vivo |
| `/onboarding/state` · `/path` · `/clubs` · `/purchase-club` · `/contract-preview` · `/accept-manager-contract` | Elección de camino (Mánager/Propietario siempre visibles), compra de club con selector de región/división, contratos de mánager |
| `/world/state` · `/world/regions` | Estado del mundo (día, temporada) y mapa de regiones |
| `/messages` + `/read` · `/messages/notifications` + `/read` | Mensajería interna y notificaciones |
| `/assistant` + `/history` | Asistente IA Caballero (contexto del club del usuario) |
| `/presence/heartbeat` · `/summary` | Presencia en tiempo real (usuarios activos) |
| `/analytics/collect` | Telemetría opt-out desde settings |
| `/scheduler/status` · `/tick` | Estado del scheduler y tick manual (ADMIN el tick) |

## Administración (`/api/admin`, todas exigen role ADMIN)

| Endpoint | Descripción |
|---|---|
| `/config` | GET/PUT de las 113 claves (respeta min/max/locked) |
| `/users` + `/[id]` | Listar/gestionar usuarios; DELETE = hard-delete seguro (borra contratos RESTRICT primero) |
| `/funds` | Añadir/quitar fondos a la wallet de un usuario |
| `/promote` | Conceder/revocar ADMIN por email (limpia `registrationIp` al conceder) |
| `/moderation` | GET bloqueadas + evidencia IpLink · POST `UNBLOCK`/`BLOCK` (única puerta de desbloqueo; nunca sobre ADMIN) |
| `/ip-audit` | Auditoría de IPs: cuentas por IP, ventanas de 30 días |
| `/vpn-exceptions` | CRUD de la lista de permitidos VPN |
| `/maintenance` | Activar/desactivar modo mantenimiento + mensaje |
| `/season-start` | Fijar el día competitivo 1 de la T1 (≥ día actual + 5) |
| `/reset` | **Backup → wipe → reseed** del mundo con token de confirmación de dos pasos |
| `/audit` | Consulta del AuditEvent con filtros |
| `/jobs` | Estado/historial de JobRun del scheduler |
| `/analytics` | KPIs de producto |

## Errores de seguridad mapeados (cliente i18n)

| code | Cuándo |
|---|---|
| `ACCOUNT_BLOCKED` | Cuenta bloqueada (login/API/refresh) — "Solo un administrador puede desbloquearla" |
| `MULTI_ACCOUNT_IP_BLOCKED` | Registro/login que dispara la regla de 30 días |
| `VPN_BLOCKED` | Política VPN activa y IP detectada como VPN/proxy |
| `INVALID_CREDENTIALS` | Login fallido (genérico, no revela cuál campo) |
| `CAPTCHA_REQUIRED` / `MAINTENANCE_MODE` | Gates correspondientes |
