import type { Dict } from "../../index";

// Knight FM — landing dictionary (Spanish, primary language). Spec §46.
export const dict: Dict = {
  // Accesibilidad / navegación
  "landing.a11y.skip": "Saltar al contenido principal",
  "landing.nav.how": "Cómo funciona",
  "landing.nav.kmie": "Partidos en vivo",
  "landing.nav.world": "El mundo",
  "landing.nav.themes": "Temas",
  "landing.nav.economy": "Economía",
  "landing.nav.security": "Seguridad",

  // Barra superior
  "landing.topbar.language": "Idioma",
  "landing.topbar.theme": "Tema",

  // Hero
  "landing.hero.kicker": "Mundo persistente · Reloj UTC · Una temporada en marcha",
  "landing.hero.headline": "Dirige tu club en el fútbol online más profundo jamás creado.",
  "landing.hero.subtitle":
    "Un mundo persistente en tiempo real donde tus decisiones construyen temporadas irrepetibles. Sin atajos. Sin pay-to-win. Sin pausas.",
  "landing.hero.ctaPrimary": "Crear mi cuenta gratis",
  "landing.hero.ctaSecondary": "Ver el mundo en acción",
  "landing.hero.live.label": "Mánagers activos ahora",
  "landing.hero.trust.wcag": "Accesible (WCAG AA)",
  "landing.hero.trust.turnstile": "Protegido con Turnstile",
  "landing.hero.trust.audit": "Registro de auditoría inmutable",
  "landing.hero.board.title": "Tablero táctico Knight",
  "landing.hero.board.subtitle": "Tu 4-3-3, listo para el pitido",
  "landing.hero.board.badge": "4-3-3",

  // Propuesta de valor
  "landing.value.kicker": "Por qué Knight FM",
  "landing.value.title": "Un mundo que no espera a nadie",
  "landing.value.subtitle": "Tres pilares que hacen de cada temporada una historia irrepetible.",
  "landing.value.pillar1.title": "Un mundo persistente 24/7",
  "landing.value.pillar1.body":
    "Un día de juego son 24 horas reales bajo reloj UTC. El mundo sigue moviéndose mientras duermes: mercados, partidos y rivales no se pausan.",
  "landing.value.pillar1.more":
    "Cada jornada se cierra a las 00:00:00 UTC y la siguiente arranca sola, sin botones de “avanzar día”. Lo que no gestiones hoy será historia mañana.",
  "landing.value.pillar2.title": "Simulación causal KMIE",
  "landing.value.pillar2.body":
    "Los mejores equipos generan mejores probabilidades. Nunca hay guiones: el motor es causal, sembrado y reproducible.",
  "landing.value.pillar2.more":
    "La fuerza de tu plantilla y tu encaje táctico alimentan las probabilidades de cada jugada. Sin rubber-banding, sin resultados escritos de antemano.",
  "landing.value.pillar3.title": "Sin pay-to-win",
  "landing.value.pillar3.body":
    "Ninguna compra afecta al resultado de un partido. Ni una sola. La ventaja se entrena, se planifica y se gana.",
  "landing.value.pillar3.more":
    "La economía es transparente y auditada: el talento manda, no la tarjeta de crédito. Lo que compras son comodidades, nunca victorias.",
  "landing.value.expand": "Más detalles",
  "landing.value.collapse": "Menos detalles",

  // Cómo funciona
  "landing.how.kicker": "Cómo funciona",
  "landing.how.title": "De cero a leyenda en cuatro pasos",
  "landing.how.subtitle": "Empezar es gratis; dejar huella, cuestión de decisiones.",
  "landing.how.stepLabel": "Paso {n}",
  "landing.how.step1.title": "Crea tu cuenta",
  "landing.how.step1.desc": "Registro gratuito con verificación por correo y protección Turnstile.",
  "landing.how.step2.title": "Elige tu camino",
  "landing.how.step2.desc":
    "Mánager al mando del vestuario o propietario construyendo un imperio de hasta 10 clubes.",
  "landing.how.step3.title": "Gestiona y compite",
  "landing.how.step3.desc": "Alineaciones, tácticas, mercado, cantera y finanzas en un mundo que no se detiene.",
  "landing.how.step4.title": "Construye un legado",
  "landing.how.step4.desc": "Ascensos, copas y un palmarés que se recuerda temporada tras temporada.",

  // Diferenciación
  "landing.compare.kicker": "Diferenciación",
  "landing.compare.title": "Knight FM frente a los mánagers tradicionales",
  "landing.compare.subtitle": "No es otra entrega anual: es otro deporte.",
  "landing.compare.colFeature": "Característica",
  "landing.compare.colKnight": "Knight FM",
  "landing.compare.colTrad": "Mánagers tradicionales",
  "landing.compare.row.time.label": "Tiempo persistente",
  "landing.compare.row.time.knight": "24 h reales por día de juego, reloj UTC",
  "landing.compare.row.time.trad": "Partidas pausables o por turnos",
  "landing.compare.row.sim.label": "Simulación",
  "landing.compare.row.sim.knight": "Causal, sembrada y reproducible",
  "landing.compare.row.sim.trad": "Guiones ocultos o rubber-banding",
  "landing.compare.row.pay.label": "Pay-to-win",
  "landing.compare.row.pay.knight": "Cero: ninguna compra cambia resultados",
  "landing.compare.row.pay.trad": "Ventajas y botín de pago frecuentes",
  "landing.compare.row.themes.label": "Temas visuales",
  "landing.compare.row.themes.knight": "5 temas con previsualización en vivo",
  "landing.compare.row.themes.trad": "1 tema fijo, o casi",
  "landing.compare.row.assistant.label": "Asistente IA",
  "landing.compare.row.assistant.knight": "Contextual y de solo explicación",
  "landing.compare.row.assistant.trad": "Inexistente, o autorizado a actuar",
  "landing.compare.row.lang.label": "Idiomas",
  "landing.compare.row.lang.knight": "4 idiomas con paridad total",
  "landing.compare.row.lang.trad": "1–2 idiomas, traducciones parciales",

  // KMIE
  "landing.kmie.kicker": "Partidos en vivo",
  "landing.kmie.title": "10 minutos que se sienten como una final",
  "landing.kmie.subtitle":
    "El motor KMIE narra cada partido en tiempo real: dos partes de 4 minutos y un descanso de 2.",
  "landing.kmie.stage1": "Primera parte",
  "landing.kmie.stageHT": "Descanso",
  "landing.kmie.stage2": "Segunda parte",
  "landing.kmie.min": "{n} min",
  "landing.kmie.total": "10 minutos en vivo por partido · pitido a las 19:00 UTC",
  "landing.kmie.chip.possession": "Posesión",
  "landing.kmie.chip.shots": "Remates",
  "landing.kmie.chip.chance": "Calidad de ocasión (xG)",
  "landing.kmie.illustrative": "Vista ilustrativa del motor · datos de ejemplo",
  "landing.kmie.replay": "Ver una repetición",
  "landing.kmie.fact1": "Sembrado y reproducible: mismo partido, mismas probabilidades.",
  "landing.kmie.fact2": "Sin resultados guionizados: la causa precede al gol.",
  "landing.kmie.fact3": "Métricas en vivo tipo xG mientras el balón rueda.",

  // Mundo y competiciones
  "landing.world.kicker": "El mundo",
  "landing.world.title": "10 regiones. 1.600 clubes. Un solo trono.",
  "landing.world.subtitle":
    "Una geografía completa de ascensos, copas y un Campeonato Mundial de Clubes al final de cada temporada.",
  "landing.world.regions": "Regiones",
  "landing.world.divisions": "Divisiones por región",
  "landing.world.clubs": "Clubes",
  "landing.world.leagueFixtures": "Jornadas de liga por club",
  "landing.world.cups": "Copas regionales · final el día 29",
  "landing.world.worldCup": "Campeonato Mundial de Clubes · 40 clubes · final el día 30",
  "landing.world.season": "Temporada de 32 días + 5 de pretemporada",

  // Temas
  "landing.themes.kicker": "Personalización",
  "landing.themes.title": "Seis temas, tu vestuario visual",
  "landing.themes.subtitle": "Púlsalos: se aplican al instante. Tu elección nunca altera el estado del juego.",
  "landing.themes.cta": "Probar tema",
  "landing.themes.active": "Activo",
  "landing.themes.hint": "Los cinco temas cumplen WCAG AA.",
  "themes.knightEmerald": "Knight Esmeralda",
  "themes.obsidian": "Obsidiana",
  "themes.royal": "Real",
  "themes.aurora": "Aurora",
  "themes.classic": "Clásico",
  "themes.onyx": "Onyx Élite",

  // Asistente
  "landing.assistant.kicker": "Knight Assistant",
  "landing.assistant.title": "Un asistente que explica, nunca actúa",
  "landing.assistant.subtitle":
    "IA contextual premium que domina el reglamento y el estado del mundo. Y tiene un límite duro.",
  "landing.assistant.guaranteeTitle": "Garantía absoluta",
  "landing.assistant.guarantee":
    "El asistente no puede ejecutar operaciones de mercado, movimientos financieros ni cambios de propiedad. Solo lee, explica y analiza.",
  "landing.assistant.chatLabel": "Conversación de ejemplo",
  "landing.assistant.illustrative": "Diálogo ilustrativo con hechos reales del reglamento",
  "landing.assistant.u1": "¿Cómo funciona el descanso en vivo?",
  "landing.assistant.a1":
    "Entre la primera y la segunda parte hay 2 minutos reales. Puedes ajustar táctica desde el tablero antes del reinicio.",
  "landing.assistant.u2": "Puja 250 por el delantero del Atlético Norte.",
  "landing.assistant.a2":
    "No puedo: ejecutar pujas o cualquier operación de mercado está fuera de mis capacidades. Te explico su cláusula y su forma si quieres.",
  "landing.assistant.u3": "¿Cuántos clubes puede tener un propietario?",
  "landing.assistant.a3":
    "Hasta 10, y nunca dos en la misma región. El servidor lo verifica en base de datos; no es solo una regla de interfaz.",

  // Economía
  "landing.economy.kicker": "Economía y $Knight",
  "landing.economy.title": "Transparente hasta el último céntimo",
  "landing.economy.subtitle":
    "Dos libros mayores separados, gravámenes claros y una frontera única con el mundo exterior.",
  "landing.economy.ledger1Title": "Tesorería del club",
  "landing.economy.ledger1Desc": "Fichajes, salarios, instalaciones y premios. Cuentas atómicas, enteras y auditadas.",
  "landing.economy.ledger2Title": "Cartera personal",
  "landing.economy.ledger2Desc": "Tu dinero de propietario y mánager, independiente de la tesorería de cada club.",
  "landing.economy.levy": "10% de gravamen",
  "landing.economy.levyDesc":
    "Sobre los ingresos de la plataforma (salario de manager, bono de referido) y los retiros. Los depósitos verificados en Solana no sufren gravamen: se acredita el 100%.",
  "landing.economy.alloc": "5% + 5% de asignaciones",
  "landing.economy.allocDesc": "5% al fondo regional y 5% al fondo del sistema para ingresos elegibles.",
  "landing.economy.solana":
    "Solana solo es la frontera de depósito y retirada. Nunca impulsa la simulación.",
  "landing.economy.riskTitle": "Aviso de riesgo del token",
  "landing.economy.risk":
    "$Knight es un activo interno con riesgo de mercado. Su valor puede subir o bajar; nunca inviertas lo que no puedas permitirte perder.",
  "landing.economy.whitepaper": "Leer el whitepaper de la economía",

  // Prueba social
  "landing.proof.kicker": "Prueba social",
  "landing.proof.title": "Cifras reales, no promesas",
  "landing.proof.subtitle": "Sin testimonios inventados ni contadores hinchados: esto es lo que ya existe.",
  "landing.proof.clubs": "Clubes en el mundo",
  "landing.proof.players": "Jugadores generados",
  "landing.proof.fixtures": "Partidos por temporada",
  "landing.proof.honest":
    "Política de honestidad: cuando haya usuarios reales en vivo, verás ese número aquí, en tiempo real.",
  "landing.proof.principle1": "Nada de pay-to-win, jamás.",
  "landing.proof.principle2": "Servidor autoritario: el cliente no manda.",
  "landing.proof.principle3": "Economía auditada y reconciliada al asiento.",

  // Seguridad
  "landing.security.kicker": "Seguridad y confianza",
  "landing.security.title": "Blindado por diseño",
  "landing.security.subtitle": "Tu cuenta, tu tesorería y el mundo entero protegidos capa a capa.",
  "landing.security.argon2.title": "Contraseñas Argon2id",
  "landing.security.argon2.desc": "Hash resistente a GPU para cada credencial.",
  "landing.security.jwt.title": "Rotación de JWT",
  "landing.security.jwt.desc": "Acceso de vida corta y refresco rotativo revocable.",
  "landing.security.turnstile.title": "Turnstile en servidor",
  "landing.security.turnstile.desc": "CAPTCHA verificado en el servidor, nunca en el cliente.",
  "landing.security.email.title": "Verificación por correo",
  "landing.security.email.desc": "Códigos de verificación y restablecimiento, auditados.",
  "landing.security.audit.title": "Auditoría inmutable",
  "landing.security.audit.desc": "Cada mutación financiera y de propiedad queda registrada.",
  "landing.security.wcag.title": "WCAG AA",
  "landing.security.wcag.desc": "Contraste, foco visible y objetivos táctiles de 44 px.",

  // Legales
  "landing.legal.privacy": "Privacidad",
  "landing.legal.terms": "Términos",
  "landing.legal.cookies": "Cookies",
  "landing.legal.play": "Juego responsable",
  "landing.legal.refunds": "Reembolsos",
  "landing.legal.token": "Riesgo del token",

  // CTA final + pie
  "landing.final.title": "El próximo pitido es tuyo",
  "landing.final.subtitle": "Únete al mundo persistente y empieza a construir la temporada que recordarán.",
  "landing.final.cta": "Crear mi cuenta gratis",
  "landing.final.note": "Registro gratuito · Verificación por correo · Sin coste inicial",
  "landing.footer.tagline": "El mánager de fútbol online persistente.",
  "landing.footer.responsible":
    "Knight FM es un juego de gestión. $Knight tiene riesgo de mercado. Juega con responsabilidad.",
  "landing.footer.rights": "© {year} Knight FM. Todos los derechos reservados.",
  "landing.footer.docs": "Documentación completa y código fuente",
  "landing.footer.docsHint": "ZIP · 10 docs técnicos: arquitectura, API, seguridad, economía, guía de administrador y análisis competitivo",
  "landing.footer.docsZip": "ZIP del proyecto — código fuente + documentación",
  "landing.footer.docsWord": "Documento Word — documentación técnica (.docx)",
  "landing.footer.navTitle": "Explora",
  "landing.footer.legalTitle": "Legal",
  "landing.footer.settingsTitle": "Ajustes",
};
