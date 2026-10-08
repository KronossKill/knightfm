# Knight FM — Análisis competitivo del género "mánager de fútbol"

> Fecha: análisis realizado tras la revisión integral de errores (Task 48).
> Fuentes: búsquedas web (2025–2026), Steam/Take-Two investor materials, comunidades de los juegos.
> Todos los datos externos son aproximados y corresponden a cifras públicas reportadas.

---

## 1. El campo de batalla

El género se divide en cuatro segmentos que compiten por el mismo tiempo de ocio:

| Segmento | Ejemplos | Modelo |
|---|---|---|
| **AAA offline/anual** | Football Manager 26 (Sports Interactive/SEGA) | Pago único (≈$60) por edición anual |
| **Mobile free-to-play masivo** | Top Eleven (Nordeus/Take-Two), OSM, Top Football Manager | F2P con IAP agresivas y anuncios |
| **Browser persistente clásico** | Hattrick (1997), ManagerZone (2001), Soccer Manager Worlds, OFM, itsagoal, footballboss | F2P + suscripción premium opcional |
| **Web3 / fantasía con activos** | Sorare (cartas NFT licenciadas) | Compra de cartas + mercado secundario |

**Knight FM compite de frente en el segmento "browser persistente clásico"** y de refuerzo contra el segmento web3 (economía real con wallet $Knight), mientras que FM26 es el referente de calidad de simulación (no directo por ser offline).

---

## 2. Perfiles de los competidores principales

### Football Manager 26 — el referente de simulación, en crisis de reputación
- Lanzamiento nov-2025 tras saltarse FM25. Acogida históricamente mala: **30.449 reseñas de Steam con un 67,8 % negativas** (≈2 reseñas negativas por cada positiva) a inicios de 2026; los foros oficiales hablan de editor roto, rendimiento exigente y funciones heredadas de la versión Unity incompletas.
- Fortalezas que conserva: base de datos real licenciada (~50 ligas), motor de partidos 3D, profundidad de scouting/entrenamiento sin igual, modding.
- Debilidad estructural: es **offline y pausable** — no hay mundo vivo compartido, ni economía entre jugadores, ni competición asíncrona real.

### Top Eleven (Nordeus / Take-Two) — el gigante mobile
- Desde 2011; Take-Two lo adquirió (2021). Nordeus + Study/Toga/Zynga suponen que **el móvil representa ~46 % de los ingresos netos de Take-Two** (Q2 FY26, $821,6 M trimestrales). Materiales de inversión citan ~129 M de jugadores registrados para su cartera móvil.
- Fortalezas: enorme distribución, live-ops pulido, marca establecida.
- Debilidades conocidas por la comunidad: **pay-to-win agresivo** (tokens, aceleradores, subastas donde el bolsillo decide), energía/temporizadores, sin licencias reales.

### OSM (Online Soccer Manager, Gamebasics) — el minimalista con licencias
- Desde 2010, web + móvil. Ligas, clubes y jugadores reales. Gestión simplificada (alineación + táctica; sin partidos jugables).
- Monetización: anuncios + "sponsor"/premium. Comunidad grande pero con sensación de "gestión ligera": poco control sobre entrenamientos, instalaciones o economía del club.

### Hattrick — el abuelo del persistente (1997)
- Cerca de **1 millón de jugadores registrados** históricos; community-driven, económicas profundas, éxitos regionales.
- Debilidades: interfaz anticuada, curva de entrada dura, sin motor visual de partido, ritmo lento (2 partidos/semana), estética y UX muy por detrás de estándares 2025.

### ManagerZone (2001) / Soccer Manager Worlds / OFM / itsagoal / footballboss
- Núcleo fiel pero pequeño: ManagerZone (fútbol + hockey, economía realista), SMW (mundos controlados por usuarios), OFM/Gaffa como browser games de batalla táctica.
- Problema común: **stack técnico viejo, onboarding confuso, población menguante por mundo**, lo que mata la competencia real en divisiones bajas.

### Sorare — la apuesta web3
- Cartas NFT de jugadores reales licenciados (acuerdo multimillón con Premier League). Fantasía de mercado más que gestión: no hay partido táctico ni club propio.
- Riesgos: dependencia del ciclo cripto, barrera económica de entrada (cartas caras), poca "gestión".

---

## 3. Tabla comparativa — Knight FM vs principales

| Dimensión | **Knight FM** | FM26 | Top Eleven | OSM | Hattrick | Sorare |
|---|---|---|---|---|---|---|
| Mundo persistente compartido | ✅ 24/7, jornada real de 24 h (reloj UTC) | ❌ offline | ✅ | ✅ | ✅ | ✅ (fantasía) |
| Jugadores reales licenciados | ❌ (mundo ficticio propio: 1.600 clubes, 32.040 jugadores) | ✅ | ❌ | ✅ | ❌ | ✅ (NFT) |
| Simulación del partido | Motor causal KMIE v3, **sembrado y reproducible** (11 climas × zonas, 8 estados de césped, moral/confianza en el OVR efectivo, 8 instrucciones tácticas, suplencias) | Motor 3D de élite | Scripted + boost de tokens | Estadístico simple | Estadístico veterano | N/A (puntos) |
| Transparencia del resultado | ✅ Semilla reproducible y acta completa; anti "rubber-banding" | ✅ (moddable) | ❌ opaco | ❌ opaco | Parcial | ❌ opaco |
| Pay-to-win | **❌ Cero**: ninguna compra cambia resultados | N/A (pago único) | ✅ severo | Parcial (sponsor) | Leve (premium no deportivo) | ✅ (capital de entrada) |
| Economía entre jugadores | ✅ Mercados directos/subastas/préstamos/cláusulas + comisión sistema 5 %, wallet $Knight en blockchain | ❌ | Parcial (IAP) | ❌ | ✅ interna | ✅ blockchain real |
| Camino "propietario" de clubes | ✅ Compra de clubes del sistema (máx. 10, 1 por región) | ❌ | ❌ | ❌ | ❌ | ❌ |
| Idiomas | ✅ 4 con paridad total (ES/EN/FR/PT) | ~14 | ~20+ | ~10 | ~40 (comunidad) | ~10 |
| Acceso | Browser, sin instalación | Cliente Steam/PC ($60/año) | App móvil | Web + app | Web | Web + crypto wallet |
| Estado de forma 2025-26 | Estable, motor v3 recién endurecido | 🔻 crisis de reseñas | Estable | Estable | Estable pero envejecido | 🔻 contracción post-cripto |

---

## 4. Ventajas defendibles de Knight FM

1. **Transparencia verificable** — la simulación sembrada y reproducible (KMIE v3) es un argumento de venta que ningún competidor mobile/persistente puede igualar hoy: cada acta es auditable, no hay "scripting".
2. **Honestidad económica** — el lema "no existe dinero gratuito ni modo demo" (fondos solo de bono de referido verificado o depósitos verificados) contrasta con el P2W de Top Eleven y con la fricción de Sorare; la comisión del 5 % bruto es la única tasa del sistema.
3. **Ritmo real de 24 h con reloj UTC** — ritmo competitivo diario que Hattrick/ManagerZone no ofrecen y que encaja con la vida adulta (decisiones cortas cada día).
4. **Doble rol Mánager/Propietario** — nadie en el género permite poseer hasta 10 clubes en un mundo vivo con economía real.
5. **Ventana de mercado ideal** — el fracaso de reputación de FM26 (67,8 % negativo) está dejando huérfana a la audiencia "hardcore de simulación"; el clásico persistente browser está envejecido; Sorare se contrajo. Es el mejor momento en 5 años para un entrante honesto.

## 5. Debilidades honestas (y plan de choque)

| Debilidad | Mitigación en curso / siguiente paso |
|---|---|
| Sin jugadores/clubes reales licenciados | Es también escudo: coste cero de licencias y sin riesgo legal; el mundo ficticio propio (1.600 clubes) es un producto, no una carencia |
| Comunidad inicial pequeña vs millones de los incumbentes | Sistema de referidos con comisión del 5 % ya operativo; divisiones regionales garantizan rivalidad desde el día 1 |
| Sin apps nativas móviles | La web ya es responsive completa (verificado en 390×844); PWA/instalable como paso siguiente |
| Motor 2D vs 3D de FM | F2P vs $60/año: el valor está en la profundidad de gestión y en el mundo vivo, no en el render |

---

## 6. Fuentes principales

- Steam Community — "Is SI cooked?" (FM26, nov-2025) y foros de Sports Interactive (sep-2025).
- IngenuityFantasy — "The Ugly Stats Behind Football Manager 2026" (abr-2026): 30.449 reseñas, 67,8 % negativas.
- Take-Two Interactive — investor materials (Nordeus/Top Eleven, lanzamiento 2011) y Mobilegamer.biz (nov-2025): móvil = 46 % de ingresos netos de Take-Two en Q2 FY26.
- WorldSoccerTalk — "Five Best Online Football Games": Hattrick ≈1 M de registrados.
- FMScout — "List of Online Football manager games" (footballboss, itsagoal, hattrick).
- BallKNW — "10 Best Free Football Manager Games (2026 Rankings)": Gaffa, Top Eleven, OFM.
- OSM — foro oficial (actualizaciones de temporada) y fichas de tienda (2010, ligas reales).
- Premier League / Sorare — acuerdo de licencia multimillón (NFT fantasy).
