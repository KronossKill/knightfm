# 05 — Seguridad

Modelo de seguridad de Knight FM tras 2 auditorías + pentest profesional (Tasks 36/38) y los mandatos anti-multicuenta (Tasks 39/41/42).

## Autenticación

- **Contraseñas**: argon2id (`@node-rs/argon2`, memoryCost 19456, timeCost 2) — nunca en texto plano, nunca en logs.
- **Access token**: JWT firmado (`jose`, HS256) con 15 min de vida; claims mínimos (sub, role).
- **Refresh token**: opaco (256 bits), almacenado hasheado en `Session`, **rotación en cada uso** (reuso = revocación de la cadena).
- **Lockout**: 5 intentos fallidos → 15 min (configurable), por cuenta+IP.
- **Captcha**: requerido en login/registro (proveedor configurable; `sandbox` en desarrollo).
- **Verificación de email**: código de 6 dígitos; sin email verificado no se emite sesión completa.
- **Recuperación**: token de un solo uso al correo; la respuesta no revela si el email existe; el cambio revoca TODAS las sesiones.

## Endurecimiento perimetral (`src/middleware.ts` + `lib/security.ts`)

- Security headers: CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Rate limit perimetral** por IP+ruta en todas las rutas API (429 con Retry-After).
- `security.txt` (RFC 9116) en `/.well-known/security.txt`.
- Sanitización de todo texto libre (mensajes, brand) contra XSS; `dangerouslySetInnerHTML` prohibido en el codebase; cookies `httpOnly`+`SameSite=Lax`.
- Validación de entrada con **zod en el 100% de los endpoints**.

## Anti-multicuenta — UNA cuenta por IP (mandato del usuario)

### 1. Registro sellado (Task 39)
- `User.registrationIp` con **índice UNIQUE**: la base de datos es el árbitro final — ni bajo carreras concurrentes pueden existir dos cuentas con la misma IP de registro.
- Los usuarios legacy (pre-regla) tienen `registrationIp` NULL.

### 2. Regla de los 30 días (Task 41)
- Cada login/registro sella evidencia en `IpLink` (cuenta↔IP con primera/última vez).
- `enforceMultiAccountIp` (`src/lib/security/ip-guard.ts`): si en la ventana `security.ipWindowDays` (default **30 días**, 1..365) la IP tiene **otra cuenta ACTIVA no-ADMIN**, TODAS las implicadas se bloquean en una transacción:
  - `updateMany` condicional (`status: ACTIVE → BLOCKED`, inmune a carreras),
  - revocación de todas sus sesiones,
  - `audit("MULTI_ACCOUNT_IP_BLOCK")` con la evidencia completa.
- Motivo estable en `User.blockedReason`: `MULTI_ACCOUNT_IP` → mensaje i18n honesto en el login ("Tu cuenta está bloqueada. Solo un administrador puede desbloquearla.").
- **Cierre de ventanas**: `requireAuth` rechaza (403 `ACCOUNT_BLOCKED`) cualquier llamada con access token vigente de una cuenta bloqueada; `/refresh` también (defensa en profundidad); el cliente hace `clear()` y aterriza en el login.
- **Desbloqueo SOLO por el administrador**: única puerta = Centro de Control → Usuarios y fondos → Moderación (o `POST /api/admin/moderation action=UNBLOCK`). No existe autoservicio.
- **Desbloqueo selectivo persistente**: solo cuentan cuentas ACTIVAS — si el admin desbloquea a A y B sigue bloqueada, A no re-dispara; si desbloquea ambas y siguen compartiendo IP, la regla re-dispara (por diseño).
- Política apagable: `security.ipMultiAccountPolicy = OFF`.

### 3. Exención total de administradores (Task 42, mandato del usuario)
Las cuentas ADMIN:
1. **Nunca se bloquean** — ni automática ni manualmente (`POST /moderation BLOCK` sobre ADMIN → 403 `FORBIDDEN`).
2. **No disparan la detección** — el early-return de `enforceMultiAccountIp` y el filtro `role != ADMIN` en contrapartes.
3. **No cuentan como "la otra cuenta"** para bloquear a un usuario.
4. **Son las ÚNICAS que pueden compartir IP** — al registrar no se les sella `registrationIp`, y al promover a alguien a ADMIN su sello se limpia (el índice UNIQUE deja de reservar esa IP).
5. Cadena hermética verificada E2E: bootstrap (sin sello) → login (sin disparo) → promoción (IP liberada) → moderación (no bloqueable).

## Política VPN/proxy (Task 25-d)

- Detector configurable (`security.vpnDetectUrl`) con evaluación cacheada por IP.
- `security.vpnPolicy`: `log_only` (default) | `BLOCK` — en BLOCK, login/registro/refresh desde VPN → 403 `VPN_BLOCKED` (bypass ADMIN solo en login).
- **Lista de permitidos** gestionada por el admin: IPs exactas o rangos CIDR (`VpnException`) que nunca se bloquean, aplicada a login, registro y refresh.

## Ciclo de vida de cuentas (Task 25-a)

- Heartbeat de `lastActiveAt` en cada uso.
- **40 días** sin acceso → `INACTIVE`; **60 días** → **hard-delete** con reversión del club al sistema (propietarios/mánagers pierden el club; el club vuelve con su nombre original).
- Los administradores son **permanentes** (nunca INACTIVE ni borrados).
- El admin puede borrar usuarios manualmente (`DELETE /api/admin/users/[id]`, borrado FK-safe).

## Mantenimiento (Task 27-b)

`ops.maintenanceMode` cierra la plataforma a todos menos ADMIN en login/registro/refresh/requireAuth; mensaje configurable.

## Pentest (Tasks 36/38) — vulnerabilidades corregidas

Auditoría tipo pentest profesional (static + active) que encontró y corrigió, entre otras:
- IDOR en endpoints de mercado/club (verificación de propiedad `club-access` centralizada).
- Carreras de puja/reserva de fondos (transacciones + decrementos condicionales).
- Fugas de información en errores (respuestas genéricas, códigos estables).
- Abuso del scheduler/tick (el tick manual exige ADMIN).
- Enumeración de usuarios vía registro/recuperación (respuestas uniformes).
- Robustez de cabeceras y cookies de sesión; saneo profundo de inputs.
- Auditoría estática de auth/sesión/cripto, admin/sistema/inyecciones y economía/mercado/races (Tasks 4-a/4-b/4-c).

## Auditoría inmutable

Toda operación sensible escribe en `AuditEvent`: logins, registros, bloqueos (`MULTI_ACCOUNT_IP_BLOCK`, `ADMIN_BLOCK_USER`), desbloqueos (`ADMIN_UNBLOCK_USER`), promociones (`ADMIN_GRANTED/REVOKED`), resets del mundo, cambios de config, fondos, VPN exceptions, depósitos/retiros… consultable en Centro de Control → Auditoría.
