# 09 — Changelog de desarrollo (45 tareas)

Historial completo de tareas. El detalle técnico de cada una está en `worklog.md` en la raíz del proyecto.

## Fase 1 — Fundación (Tasks 0–6)
- **0** Bootstrap del proyecto, worklog, dependencias
- **1** Verificación de fundamentos + diccionario PT
- **2** Auth + Onboarding (API+UI) · Landing premium de 12 secciones (2-b) · integración final
- **3-a/3-b** APIs del núcleo del juego (mundo, club, jugadores, tácticas, entrenamiento, instalaciones, cantera, competiciones) y plataformas (mercados, tesorería, wallet/Solana, mensajes, admin, asistente, presencia, scheduler, analítica)
- **4** Tablero Táctico insignia (4-b) + auditorías estáticas (4-a auth/cripto, 4-b economía/IDOR, 4-c admin/inyecciones)
- **5/6** Verificación E2E en navegador e integración final

## Fase 2 — Correcciones y módulos (Tasks 7–14)
- **7** Emails reales (proveedores + código on-premise de respaldo)
- **2-img/9-img** Imágenes AI de instalaciones (6 tipos × 5 niveles)
- **3-a/3-b/3-c** Asistente flotante, sesiones de entrenamiento manual, ojeo con gating, compra/renuncia de club de mánager, pestaña de acceso admin
- **8** Oleada de 8 ajustes solicitados por el usuario
- **9** Oleada: perfil de jugador (cesión/venta/subasta/cláusula), staff por áreas, habitaciones de descanso, política de gravámenes, admin desbloqueado
- **10** Logo oficial, volteo del campo, Mundial solo 1ª división, staff por estrellas, botones por carta de plantilla
- **11** Gestión de jugadores + fondos a clubes + regla refinada de clasificación al Mundial
- **12** Entrenamiento general único + entrenamiento individual por tipo
- **13/14** Tokens de recuperación visibles en test; **Brevo SMTP** end-to-end
- **14-b** Dónde ver el token del admin

## Fase 3 — Profundidad de gestión (Tasks 15–23)
- **15** Definir otros admins desde el CC, fondos a usuario, badges WC solo 1ª división, flujo sin club (cambiar de club abandona la gerencia actual)
- **16** Depósitos Solana sin gravamen + navegación al depósito
- **17** Onboarding siempre muestra Mánager/Propietario + contador de presencia en vivo
- **18** Fix superposición en Tácticas
- **19** Entrenamiento individual: tarjetas por tipo + dropdown con posiciones
- **20** Fichaje staff star-first (elige estrellas → persona)
- **21** Precios por estrellas, TODO configurable en el CC, ojeo 1/día, ascensos 3↑/3↓, contratos hasta fin de temporada, brackets visuales, nombres claros de opciones
- **22** Motor de ascensos/descensos endurecido y probado ("eso no puede fallar")
- **23** Ojeo revela = estrellas del ojeador · 10% retiro club→dueño · selector de región con nombres creíbles · envejecimiento cada 30 días reales · instalaciones estrictamente por club · cesiones hasta fin de temporada

## Fase 4 — Seguridad y economía fina (Tasks 24–27)
- **24-a** Branding de club: nombre, escudo (forma+patrón), dos colores
- **24-b** SEO completo (JSON-LD, sitemap, OG 1200×630)
- **24-c** Perímetro anti-hacking (middleware, security.txt, sanitización, rate limit)
- **25** Ciclo de vida 40d/60d con admins permanentes, salario semanal, inicio de T1 por admin, gravamen de ingresos de club, pool de agentes libres configurable, entrenamiento multi-factor, política VPN con excepciones (25-a/b/c/d)
- **26** Ver plantilla ajena para cláusulas, despidos pagan días restantes→SYSTEM, capacidad de cantera impulsa ojeo, premios por victoria por competición
- **27-b** Mantenimiento efectivo end-to-end + borrado manual de usuarios por admin

## Fase 5 — Mundo y confianza (Tasks 28–37)
- **28–32** Olas de correcciones de UX y balance reportadas por el usuario
- **33-lead** Gravamen 10% ingresos de usuario + venta de clubes al 90% + barrido visual (33-v1/v2/v3)
- **35** Reset del mundo REAL (backup→wipe→reseed, era un stub)
- **36/38** **Pentest profesional**: vulnerabilidades detectadas y corregidas
- **36-b** Retiro mínimo configurable + equivalente USD en precios
- **37** Reset según mandato: pretemporada ≥5 días, cero historial, fondos configurados, clubes del sistema sin staff, retención de historial 2 temporadas
- **38-b** **Mundial desde la Temporada 2** (en T1 no hay clasificados)

## Fase 6 — Anti-multicuenta y administración (Tasks 39–45)
- **39** **Una cuenta por IP**: `registrationIp` UNIQUE, no se admiten multicuentas
- **40** **Análisis competitivo** con 13 rivales (ver 08-competencia.md)
- **41** **Regla de 30 días**: 2 cuentas en la misma IP → bloqueo automático de todas; desbloqueo SOLO del admin (Moderación en el Centro de Control); evidencia IpLink + auditoría
- **42** **Exención total de admins**: nunca se bloquean y son los ÚNICOS que pueden compartir IP (login, detección y registro)
- **43** Cuenta de administrador por defecto configurable vía `ADMIN_BOOTSTRAP_EMAIL` (seed promote-if-exists + config + migración de DB; placeholder admin@knight.fm eliminado)
- **44** Segunda cuenta del propietario promovida a ADMIN (registrationIp liberado, audit ADMIN_GRANTED)
- **45** **Documentación completa** (esta carpeta) + ZIP descargable desde la propia app
