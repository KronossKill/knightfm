# 02 — Base de datos

SQLite (`db/custom.db`) vía Prisma 6. El schema completo está en `prisma/schema.prisma`. Modelos principales agrupados por dominio:

## Identidad y seguridad

| Modelo | Función | Notas clave |
|---|---|---|
| `User` | Cuenta | `role` USER\|ADMIN, `path` MANAGER\|OWNER, `status` ACTIVE\|INACTIVE\|BLOCKED (DELETE = hard-delete), `passwordHash` argon2id, `emailVerified` |
| `Session` | Sesión de refresh | Token opaco rotativo; el bloqueo/logout revoca todas |
| `VerificationToken` | Códigos email / reset | Identificador + token hasheado + expiración |
| `IpLink` | **Evidencia cuenta↔IP** | `@@unique([userId, ip])`, `firstSeenAt`/`lastSeenAt`, índice `(ip, lastSeenAt)`. Sellada en cada login/registro; alimenta la regla de 30 días |
| `Presence` | Presencia en vivo | `@@unique(userId)`, heartbeat cada ~45 s |
| `AuditEvent` | Auditoría inmutable | `type`, `actorId`, `payload` JSON — toda operación sensible queda registrada |
| `VpnException` | Lista de permitidos VPN | IP exacta o CIDR, aplica a login/registro/refresh |

### Campos anti-multicuenta en User
- `registrationIp` **UNIQUE** — exactamente UNA cuenta por IP sellada al registro (SQLite permite NULLs ilimitados: usuarios legacy y **admins**, que nunca se sellan).
- `lastLoginIp` — solo telemetría de auditoría, NUNCA bloquea.
- `blockedReason` (`MULTI_ACCOUNT_IP` \| `ADMIN_MANUAL`) + `blockedAt` — motivo estable mapeado a i18n en el cliente.

## Mundo y competición

| Modelo | Función |
|---|---|
| `Region` / `Division` / `Club` | Geografía: 10 regiones × 10 divisiones × 16 clubes. `Club.managerId` (mánager, SET NULL al borrar), `Club.ownerId` (propietario), `Club.systemOwned`, `Club.operatingFund`, nombre original para reversiones |
| `ClubBrand` | Escudo (forma, patrón) + dos colores + iniciales (personalizable por el propietario) |
| `Player` | 32.000 jugadores: atributos JSON por familias (technical/physical/mental), ovr/potential/stars, marketValue/salary/releaseClause, forma/fatiga/frescura/moral/confianza, edad, `clubId NULL` = agente libre, `isFreeAgent` |
| `Season` | Nº, `startEpochDay`, estado, prize pools (league/cup/world) |
| `Fixture` | Calendario ida-vuelta por división con día UTC de kickoff |
| `Match` / `MatchEvent` | Partido simulado + eventos (goles, tarjetas, lesiones) |
| `Standing` | Clasificación por división (PJ/W/D/L/GF/GC/Pts) |
| `CupRun` / `WorldCupSlot` | Bracket de copa regional + clasificados del Mundial |
| `PrizePool` | Bote acumulado por competición |
| `TransferRecord` | Historial de traspasos |

## Gestión de club

| Modelo | Función |
|---|---|
| `Lineup` / `TrainingPlan` | Alineación (formación + slots) y plan de entrenamiento por club |
| `Facility` / `FacilityUpgrade` | 6 instalaciones (Estadio, Centro de Entrenamiento, Cantera, Ciencias, Médico, Descanso) nivel 1–10 + upgrades en curso |
| `StaffMember` | Cuerpo técnico por área (Entrenador, Ojeador, Médico, Ciencias, Descanso), calidad 1–5 estrellas |
| `LedgerEntry` | Libro mayor de la tesorería del club (entrada/salida, motivo, saldo) |
| `OwnershipRecord` | Historial de propiedad del club |
| `YouthProspect` / `YouthScoutSession` | Canteranos revelados por ojeo (1 por estrella del ojeador) y sesiones de ojeo diarias |
| `TrainingSession` | Sesiones ejecutadas con desglose multi-factor |
| `AttributeSnapshot` | Historial de atributos por fecha |

## Economía y usuario

| Modelo | Función |
|---|---|
| `PersonalWallet` | Cartera $Knight del usuario (1:1 con User) |
| `DepositRequest` / `WithdrawalRequest` | Depósitos (verificación Solana, sin gravamen) y retiros (levy configurable, mínimo configurable) |
| `BlockchainTransaction` | Registro de tx on-chain verificadas |
| `PriceSnapshot` | Histórico de precio $Knight→USD |
| `Listing` / `Bid` | Subastas y pujas de jugadores |
| `ManagerOffer` / `ManagerContract` | Ofertas de clubes a mánagers y contratos (duración = días restantes de temporada) |
| `Message` / `Notification` | Mensajería interna y notificaciones |
| `AssistantEntry` | Historial del asistente IA Caballero |
| `ConfigKey` | 113 claves de configuración (defaultValue + currentValue + min/max + locked) |
| `SystemState` | Estado global (`world.epoch.utc`, `scheduler.lastDay`) |
| `FundBalance` | Fondos del mundo por scope (SYSTEM, REGION:x…) |
| `JobRun` | Idempotencia del scheduler (jobType + dayKey) |
| `AnalyticsEvent` | Telemetría de producto (landing + juego) |
| `Approval` | Solicitudes pendientes (p. ej. tokens de reset) |

## Integridad referencial (SQLite DDL real)

```
User.referredById        → User.id        [SET NULL]
Session.userId           → User.id        [CASCADE]
Presence.userId          → User.id        [CASCADE]
Club.managerId/ownerId   → User.id        [SET NULL]
ManagerContract.managerId→ User.id        [RESTRICT]  ← borrar contrato antes que usuario
PersonalWallet.userId    → User.id        [RESTRICT]
Message.from/toUserId    → User.id        [RESTRICT]
Notification.userId      → User.id        [CASCADE]
IpLink.userId            → User.id        [CASCADE]
```

> Nota operativa: para forensics FK usar `node:sqlite` (los PRAGMA vía `$queryRawUnsafe` pueden devolver vacío).
