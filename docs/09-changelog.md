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
- **43** Cuenta de administrador por defecto = **kronoss2803@gmail.com** (seed promote-if-exists + config + migración de DB; placeholder admin@knight.fm eliminado)
- **44** **libreventas581@gmail.com (Kronoss) promovida a ADMIN** (registrationIp liberado, audit ADMIN_GRANTED)
- **45** **Documentación completa** (esta carpeta) + ZIP descargable desde la propia app

## Fase 7 — Entrega, UI/UX v2.0 y motor KMIE 2.0 (Tasks 90–100)
- **90/94** Entrega sellada con builder autoauditado (KFM-OPS-015/020/023) + wallet QR + registro reforzado + panel de descargas
- **91/99** Sistema de diseño v6 → v2.0: 5 temas WCAG AA (115 pares verificados), widgets drag&drop con presets server-side, paleta Ctrl+K (favoritos + pila), deep-linking, World Pulse y 4 widgets nuevos
- **95** Descarga de zips desde la raíz del sitio (redirección 307)
- **96** Guía completa GitHub + Supabase + Vercel sin perder datos (`docs/GUIA-DESPLIEGUE-GITHUB-SUPABASE.md`)
- **100** **Auditoría forense del motor** (evidencia: el clima/terreno/felicidad nunca existieron en ninguna entrega) + **KMIE 2.0**: clima por banda climática de región, estado del terreno según estadio + clima, volatilidad oculta "día de forma", árbitro de humor variable, felicidad de suplentes, estilos tácticos Con/Sin balón aplicados de verdad (antes eran columnas muertas), encaje posicional real en la fuerza del XI, lesiones según Centro Médico + Ciencia Deportiva, franja de condiciones en el informe (4 idiomas) y 4 claves de admin
- **101** **Motor TRAMA** (spec "Parte 3" subida por el usuario): nudos de 5 pasos con temperatura de azar variable, 5 hilos (Mundo/Cuerpo/Mente/Juego/Azar), bandas graduadas con colas pesadas, marea, lectura adaptativa, gestión del marcador, cisnes negros con presupuesto de caos, experiencia (madurez/bagaje/Fexp), equidad con ventaja local acotada y calibración 12k partidos (13 métricas vs tabla 3.13, dominancia <58%, simetría <3%)

## Fase 8 — Diseño definitivo "Nexus" y corrección del login (Task 103)
- **103** Captura del usuario: Turnstile bloqueado por la CSP en producción
  (knightfm.vercel.app) → «El captcha no se pudo cargar» en cada login. CSP con
  host acotado challenges.cloudflare.com (script/frame/connect/img-src),
  captcha.ts con reintento+timeout, botón «Reintentar verificación» (4 idiomas).
  Además se implementa el DOCX del usuario «Diseño visual definitivo»: tema 6
  **Nexus** (azul noche #0A0F18 / pizarra #151E2D / lima #B7F34A / blanco frío
  #E8EEF6) como NUEVO DEFAULT, tipografía Inter con números tabulares, radios
  12 px, sidebar 240/80 px + topbar 64 px y sección activa con línea de acento
  lima (spec §1–§3). WCAG 6 temas × 22 pares: ALL PASS.

## Fase 9 — Hotfix login: Turnstile visible y sin cuelge eterno (Task 105)
- **105** Segunda captura del usuario: el login sigue colgado («el sitio se
  queda cargando») con la CSP ya corregida. Causa raíz real en el cliente: el
  widget se renderizaba fuera de pantalla 1×1 px → toda escalada interactiva
  de Cloudflare (p. ej. bajo extensiones/visores tipo surfs.*) quedaba sin
  resolver y el spinner era eterno. captcha.ts: mount visible en el
  formulario (interaction-only), watchdog 180 s/60 s, todos los caminos
  resuelven (error/expired/timeout/global ausente/excepción). AuthFlow: mount
  en login/registro/verificar/recuperar + mensaje nuevo «La verificación no
  terminó a tiempo» (4 idiomas). CSP: worker-src 'self' blob:. siteverify sin
  URLSearchParams (crash urlSearchParams.entries() del runtime Vercel fuera
  del camino del login). E2E con claves test 1x…AA de Cloudflare: login real
  OK, fallo → Reintentar, recuperación OK, móvil OK.

## Fase 10 — Rediseño integral: sistema visual, menú, progreso e imágenes (Task 106)
- **106** Mandato "rediseño integral nivel sénior" con orden explícito
  (sistema visual+menú → pantallas → imágenes). Paleta EXACTA del usuario en
  Nexus (#080D15/#101927/#192638/#B7FF38/#55A7FF/#F1F5FB/#A2B1C5), WCAG 6×22
  ALL PASS. Menú lateral premium (indicador lima redondeado, tooltips Radix
  colapsado, aria-label, separadores). Progreso contextual: RingProgress
  (obra/plantilla), MilestoneTimeline (5 fases derivadas del % real),
  FormDots (forma real por club en clasificación vía status=PLAYED),
  Sparkline (saldo real del libro mayor), DeltaPill, EmptyState+acción.
  Biblioteca 30 imágenes 16:9 (1344×768) 6 tipos × 5 estados con base única
  por tipo y derivación por IA (misma instalación evoluciona); next/image +
  aspect-video. Guards overflow en tablas de Control Center y diálogo rival.
  E2E navegador: login→shell, clasificación con forma (W/L reales), obras con
  anillo+timeline, tesorería con sparkline real, tooltips colapsado OK,
  móvil 390 OK, 0 errores de consola.
