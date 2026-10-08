# 06 — Guía del administrador

## Cuentas de administrador

| Cuenta | Usuario | Rol |
|---|---|---|
| Valor de `ADMIN_BOOTSTRAP_EMAIL` | kronoss2803 | ADMIN (cuenta por defecto de la plataforma) |
| (segunda cuenta del propietario) | Kronoss | ADMIN (promovida a petición del usuario) |

- Contraseña bootstrap: la define `ADMIN_BOOTSTRAP_PASSWORD` en el `.env` del servidor — **nunca** en código ni en documentación pública. Cámbiala tras el primer login.
- Quien se registre con un email de `admin.bootstrapEmail` nace ADMIN (sin sello de IP).
- Promover/revocar: Centro de Control → Usuarios y fondos (o `POST /api/admin/promote`). Al conceder ADMIN se limpia `registrationIp` (exención total de la regla 1-cuenta/IP).
- Los admins **nunca** se bloquean (ni auto ni manual) y son los únicos autorizados a compartir IP.

## Primer acceso

1. Abre la app → botón **"Crear mi cuenta gratis"** (abre el modal de autenticación) → pestaña **Iniciar sesión**.
2. Introduce email + contraseña + captcha.
3. En la pantalla de elección de camino pulsa **"Solo Centro de Control"** (opción exclusiva de admins: entra sin club).
4. El botón **Centro de Control** aparece en el menú lateral (si ya tenías sesión abierta antes de un cambio de rol, haz refresh o re-login).

## Centro de Control — pestaña por pestaña

### 1. Configuración
Las **113 claves** del mundo agrupadas por dominio (world, competition, economy, markets, players, youth, operations, facilities, training, staff, security, solana). Cada clave muestra nombre, valor actual, defecto, mín/máx y descripción. Las claves `locked` no son editables. Guardado inmediato con auditoría.

### 2. Usuarios y fondos
- **Gestión de usuarios**: buscar, ver estado/rol, **Agregar fondos** a la wallet de cualquier usuario, promover/revocar ADMIN, borrar cuenta (hard-delete FK-safe).
- **Excepciones VPN**: lista de permitidos (IP exacta o CIDR) — nunca se bloquean aunque el detector los marque.
- **Auditoría de IP (anti-multicuentas)**: evidencia cuenta↔IP con primera/última vez, agrupada por IP.
- **Moderación de cuentas**: cuentas bloqueadas con motivo (`MULTI_ACCOUNT_IP` = multicuenta · `ADMIN_MANUAL` = bloqueo administrativo), fecha y IPs de evidencia; **desbloqueo** con confirmación (única puerta de desbloqueo). Nunca permite bloquear a un ADMIN.

### 3. Mantenimiento
- **Modo mantenimiento** on/off + mensaje (solo admins operan mientras esté activo).
- **Inicio de la Temporada 1**: fija el día competitivo 1 (mínimo: hoy + 5 días de pretemporada).
- **Reset del mundo**: acción destructiva de **dos pasos** — "Solicitar token de confirmación" (llega al email del admin) → pegar token + confirmar. Pipeline real: **backup automático → wipe FK-safe → reseed**. Se conservan usuarios, wallets, config, auditoría, depósitos/retiros, notificaciones y mensajes; se destruye TODO historial de partidos (mandato del usuario). El mundo renace en pretemporada (≥5 días) con los fondos de club configurados.

### 4. Jobs
Estado del scheduler: día actual, último día procesado, historial de `JobRun` (SALARY, ROLLOVER, INACTIVITY, MATCHES…) y tick manual.

### 5. Auditoría
Consulta del `AuditEvent` con filtros por tipo/actor/fecha. Toda operación sensible queda aquí.

### 6. Analítica
KPIs de producto: registros, activos diarios (presencia real), conversión onboarding, uso de mercados.

## Operaciones frecuentes

| Quiero… | Hago… |
|---|---|
| Desbloquear una cuenta multicuenta | Usuarios y fondos → Moderación → Desbloquear (confirmar) |
| Averiguar por qué se bloqueó | Moderación muestra motivo + IPs; Auditoría filtra `MULTI_ACCOUNT_IP_BLOCK` |
| Dar acceso admin a un email | Usuarios y fondos → promover, o añadir el email a `admin.bootstrapEmail` para registros futuros |
| Apagar la regla de 30 días | Configuración → `security.ipMultiAccountPolicy = OFF` |
| Ampliar la ventana anti-multicuenta | `security.ipWindowDays` (1..365, default 30) |
| Cambiar el precio de fichajes de staff | `staff.starFee.1…5` |
| Parar el mundo temporalmente | Mantenimiento → activar modo |
| Recomenzar la liga de cero | Mantenimiento → Reset del mundo (token por email) |
| Ver quién comparte IP | Usuarios y fondos → Auditoría de IP |

## Notas operativas

- El reloj del mundo es **UTC server-authoritative**: no existe progresión manual ni salto de jornadas.
- El reset genera un backup automático previo (restaurable manualmente desde `db/`).
- Tras un reset, el scheduler reinicia su cursor (`scheduler.lastDay = 0`) — los trabajos diarios vuelven a ejecutarse desde el día 1.
- Para forensics de base de datos usa `node:sqlite` (los PRAGMA vía `$queryRawUnsafe` pueden devolver vacío); ojo con `ManagerContract.managerId` (RESTRICT) al borrar usuarios.
