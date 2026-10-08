# Competitor Research — Sector de Football Manager MMO / Online Soccer Manager Games
**Proyecto:** Knight FM (Task 40-research) · **Fecha:** investigación vía web-search (CLI z-ai-web-dev-sdk), 34 queries ejecutadas · **Fuentes:** snippets de resultados (host citado inline) guardados en `/home/z/my-project/tool-results/research/s*.json`

**Contexto Knight FM (worklog tasks 36–39):** MMO de gestión de fútbol en Next.js; mundo persistente UTC server-authoritative (1 día juego = 24 h reales); ligas regionales/divisiones con 1600 clubes y ~32k jugadores; copas regionales + Mundial de Clubes desde T2; economía $Knight con depósitos/retiros vía Solana y precio $Knight/USD; mercado de pases (subastas, compra directa, préstamos, cláusulas, agentes libres); staff/instalaciones/entrenamiento/canteras; asistente IA read-only; i18n ES/EN/FR/PT; 1 cuenta por IP; auditoría de seguridad tipo pentest completada (38).

---

## 1. Tabla resumen de competidores

| # | Nombre | Empresa | Año | Precio | Plataformas | Multijugador MMO | Economía real (depositable) | Licencias reales | Móvil |
|---|--------|---------|-----|--------|-------------|------------------|------------------------------|------------------|-------|
| 1 | Football Manager 26 (FM26) | Sports Interactive / SEGA (UK) | 2025 (serie desde 2005; FM25 cancelado) | Premium $59.99 (Game Pass) | PC (Steam/Win/Linux), consolas | No (SP + community FMFC) | No | Sí — Premier League (escudos, kits, fotos), fútbol femenino | Touch móvil aparte |
| 2 | Online Soccer Manager (OSM) | Gamebasics → Miniclip (NL) | ~2005/2012 (adquisición 2021) | F2P (ads + Boss Coins IAP) | Web, iOS, Android | Sí (ligas con amigos) | No | Sí — ligas/clubes/jugadores reales de todo el mundo | Sí (principal) |
| 3 | Hattrick | ExtraTerrestrial Software AB (SE) | 1997 (25+ años) | F2P + "Supporter" por suscripción | Web | Sí (el MMO veterano por excelencia) | No (dinero virtual) | No (ficticio, 130+ países) | Web móvil (PWA-ish) |
| 4 | Top Eleven 2026 | Nordeus (RS) | 2010 (live service anual) | F2P agresivo (tokens IAP, sponsors) | iOS, Android, Web | Sí (PVP realtime, asociaciones ≤5 amigos) | No | Parcial (clubes partner/campañas) | Sí (principal) |
| 5 | ManagerZone | PowerChallenge AB (SE) | 2001 | F2P + Club Membership | Web | Sí (fútbol + hockey hielo) | No | No | Web móvil |
| 6 | Soccer Manager (2024/26 + Worlds) | Soccer Manager Ltd (UK) | ~2004; Worlds persistente | F2P (+ premium) | Web, iOS, Android, Steam | Sí (Soccer Manager Worlds) | No | Sí — ligas reales (SM 2024/26) | Sí |
| 7 | Striker Manager 3 | U-Play Online (ES) | 2023 | F2P + Play-to-Earn (assets propios) | Web, Steam, Epic, iOS, Android | Sí | Sí (P2E / activos en juego propios) | No | Sí |
| 8 | Soccerverse | Soccerverse Ltd (Londres; motor XAYA + Polygon) | 2025 (S1 ene-2025; seed $3.2M jul-2024) | F2P (gas/tokens on-chain) | Navegador | Sí (MMO multirrol) | Sí (on-chain) | No | Browser móvil |
| 9 | OFM (Online Fussball Manager) | Stillfront (adq. 2017) | veterano (DE) | F2P + premium | Web, Android | Sí | No | No | Sí |
| 10 | GOAL! The Club Manager | (DE, indie) | 2023+ (Steam EA) | Premium con descuentos agresivos | PC | SP (+online limitado) | No | Parcial | No |
| 11 | WE ARE FOOTBALL 2024 | Winning Streak Games (GOG/Steam) | 2021/2024 | Premium (~$30-40) | PC | No | No | Sí — Bundesliga 1ª/2ª masc./fem. | No |
| 12 | Anstoss (clásicos) / Anpfiff Manager | (DE, Koertge en móvil) | 1993+ | Premium legacy / F2P móvil | PC / Android | No (Anstoss) | No | Anstoss: Bundesliga 3D | Anpfiff sí |
| 13 | GoalTycoon → BuildTycoon | (blockchain) | pivote reciente | P2E on-chain | Web | Sí | Sí | No | Web |

Nicho largo-tail adicional detectado: rockingsoccer.com, freekick.org (fmscout), Gaffa, OFM rankings (ballknw/worldfootballmanager), itch.io tags "football+manager", Top Football Manager 2026 (mobile), FMdB (app de base de datos del ecosistema FM).

---

## 2. Fichas por competidor (características + fortalezas/debilidades)

### 2.1 Football Manager 26 — Sports Interactive / SEGA
- **Qué es:** el rey del género, single-player con base de datos gigante; FM26 salió **4-nov-2025 a $59.99** tras la **cancelación total de FM25** y reconstrucción sobre **motor Unity** (strategygame.org, hrkgame, siftergames).
- **Licencias:** **Premier League licenciada** (escudos, kits, fotos oficiales de jugadores) y **fútbol femenino** incluido; elementos FIFA/licencia de competiciones (bet365, gamepressure).
- **Match engine:** 3D renovado en Unity; comunidad menciona partidos "de 90 minutos gestionables" (steamcommunity).
- **Distribución:** Steam + **Game Pass**; price war inmediato (−62% a ~$23 en semanas; gamepriceradar).
- **Recepción:** **~33% Steam positive con 32k reviews** (gamepriceradar); community posts "no vale >$10" (sports-interactive forums); FM20→FM26 rankings tibios (ingenuityfantasy).
- **Fortalezas:** base de datos/realismo insuperados, licencias, marca, Game Pass.
- **Debilidades explotables:** NO es MMO ni mundo persistente; precio premium; crisis de confianza post-FM25/FM26; monetización cero flexibilidad (una vez comprado, sin economía social viva).

### 2.2 Online Soccer Manager (OSM) — Gamebasics / Miniclip
- **Escala:** **3M+ usuarios mensuales** en web+móvil en la adquisición por **Miniclip (19-ene-2021)** (gamedeveloper, gamesindustry); "4M usuarios" (2017, msx.org) y "5M mensuales" (3d-mike).
- **Modelo:** **F2P puro**: anuncios diarios, patrocinadores de club, y **Boss Coins** (IAP) (support.onlinesoccermanager, reddit).
- **Contenido:** **todas las ligas/clubes/jugadores reales del mundo**; ligas con amigos, copas, tácticas simples, mercado de fichajes; OSM 26/27 anualizado (chrome-stats).
- **Crítica recurrente:** deriva **pay-to-win** (YouTube "OSM becoming P2W"; reddit quejas de balance), profundidad táctica limitada; sin engine de partido visual (resultado simulado).
- **Fortalezas:** onboarding simple, marca Miniclip, multiplataforma, licencias.
- **Debilidades:** monetización ad-first, P2W, mundo por-liga-no-persistente (ligas se recrean), poca economía de club.

### 2.3 Hattrick — ExtraTerrestrial Software (Suecia)
- **Veterano absoluto:** online desde **1997**; ligas en 130+ países; ritmo **semanal** (partidos 1-2×/semana), gestión a largo plazo "a tu ritmo" (hattrick.org/es).
- **Economía de club profunda:** ingresos de patrocinador, tipos de interés, sueldos, **staff (entrenadores, médicos)**, **cantera juvenil con agentes y honorarios**; el paquete **Supporter** amplía info de partidos y herramientas (hattrick.org Saga).
- **Estructura competitiva:** copas nacionales, **Continental Cups**, **selecciones nacionales absolutas y U20 con Mundial**, federaciones user-run, **Hattrick Arena** (hub de torneos/ladders fuera del juego principal), liga femenina (Hattrick Femme International) y Homegrown League (hattrick.org, FB oficial, wiki).
- **Monetización:** suscripción **Supporter** — criticada: "Hattrick is pricing itself out of the market with the supporter fees" (reddit r/hattrick).
- **Fortalezas:** comunidad veterana y leal, mundo persistente real (25+ años), profundidad social (federaciones, foros), confianza histórica.
- **Debilidades:** UI/datos anticuados, ritmo lento para el jugador móvil moderno, supporter fees polémicos, sin economía real, engine textual.

### 2.4 Top Eleven 2026 — Nordeus
- **Escala:** **+300M usuarios registrados** (nordeus.com, ago-2025); **1M DAU ya en 2011** (techcrunch); 15M MAU (2014, wikipedia); 130M registrados (sprungstudios).
- **Match:** **motor 3D en vivo + PVP realtime** (App Store oficial); partidos programados con espectadores.
- **Loop live-service:** temporadas anuales (2025→2026→2027), **sponsors TV/tokens**, **asociaciones con hasta 5 amigos** y torneos de fin de semana, cantera (tokens/Temporada), instalaciones, merchandising (nordeus, fandom).
- **Monetización agresiva:** tokens premium, **"Special Sponsor"/Elite Sponsor** tachados de scam/bait por la comunidad (reddit, foro oficial) — quejas de tasks ocultas y push a gastar.
- **Fortalezas:** mobile-first pulido, social PVP, live ops de categoría mundial, escala.
- **Debilidades:** presión monetaria fuerte, economía cerrada (tokens sin valor real de salida), quejas P2W, mundo no persistente entre temporadas propias (resets de liga).

### 2.5 ManagerZone — PowerChallenge AB (Suecia, 2001)
- Fútbol **y hockey hielo** en un mismo portal; "world leading sport management games online for free" (managerzone.com).
- Economía de club completa: decisiones de **economía, fichajes, entrenamiento** (managerzone.com/es); drafting y desarrollo (startupintros).
- **Problema histórico de integridad:** foro oficial con hilos de "suspicious transfer or inflation? …many cheaters" (ene-2024, managerzone.com forum) — anti-multicuentas/anti-lavado percibido como débil.
- Fortalezas: veterano, dual-sport, comunidad estable. Debilidades: envejecido, membership genérica, vigilancia de mercado manual.

### 2.6 Soccer Manager (2024/26 + Soccer Manager Worlds) — Soccer Manager Ltd
- Doble producto: carrera single-player **gratuita** con ligas reales (Steam/móvil) y **Soccer Manager Worlds** (mundo online persistente multiusuario).
- Aparece en todos los rankings F2P 2026 junto a Top Eleven y OSM (worldfootballmanager.com, ballknw).
- Fortalezas: gratis, licencias, Worlds persistente poco común. Debilidades: presentación/engagement menores que Top Eleven; Worlds poco poblado según comunidades.

### 2.7 Striker Manager 3 — U-Play Online (España, 2023)
- Se vende como "el mejor **multijugador** football manager **play to earn**" con "**own your in-game assets**" (Steam, Epic, Google Play).
- Origen español: comunidad ES/latam fuerte; nodos (cuidados), fondos, mercado entre usuarios (uplayonline, strikermanager.com/es).
- Dual web+móvil+Steam/Epic gratis; comparativas de prensa/YT "¿mejor que Top Eleven y Soccer Manager?".
- Fortalezas: economía con propiedad real, nicho hispanohablante, cross-platform. Debilidades: base de usuarios pequeña, escepticismo P2E, visuals simples.

### 2.8 Soccerverse — Soccerverse Ltd (Londres) ★ competidor más cercano a Knight FM
- **Browser-based football management MMO**, **Season 1 en enero-2025**; **$3.2M seed (jul-2024)** (vcbacked, nftnewstoday).
- **Multi-rol**: manager, **agente**, **dueño de club**, **trader de bolsa de jugadores**, scout (clarnium) — economy de mercado de pases como juego en sí mismo.
- **On-chain**: lógica en **XAYA**, transacciones en **Polygon**; votación de decisiones del club (community-driven) (blockchaingames.fun, clarnium).
- F2P con gas/tokens; clubes/activos con propiedad real.
- Fortalezas: diseño multirrol innovador, mundo persistente, economía real verificable. Debilidades: menor masa crítica, dependencia crypto, onboarding técnico (wallets).

### 2.9 OFM — Online Fussball Manager (Stillfront)
- Adquirido por **Stillfront (jul-2017)** como activo rentable de nicho (stillfront.com).
- App móvil con **mercado dinámico, cantera, infraestructura de estadio, partidos diarios y eventos** de largo plazo (softonic); versiones tipo "match every 30 minutes" (apkpure "Best Eleven"/OFM 2023).
- Fortalezas: longevidad, simplicidad. Debilidades: envejecido, alcance regional DACH.

### 2.10 Otros PC premium
- **GOAL! The Club Manager (DE):** motor táctico moderno (heatmap, reglas actuales) "sin micromanagement de hojas de cálculo"; Steam con descuentos 80% — guerra de precios en PC premium.
- **WE ARE FOOTBALL 2024 (Winning Streak):** 3 modos (club elegido, club creado, carrera), **licencias Bundesliga 1ª/2ª masculina y femenina**, foco single-player PC.
- **Anstoss 1-3 (legacy DE):** 3D real + gestión profunda + expansión de estadio; bundle a precio bajo — referencia nostálgica.
- **Anpfiff Manager 2026 (móvil DE):** 3 ligas de 18 clubes, entrenamiento individual, traspasos — ejemplo de nicho móvil regional.

---

## 3. Características comunes del sector (benchmarks de facto)
1. **Multijugador asíncrono por ligas/temporadas** — universal; el diferencial "mundo persistente único compartido" solo lo tienen Hattrick, ManagerZone, Soccer Manager Worlds, Soccerverse (y Knight FM).
2. **Mercado de pases con subastas** — estándar (OSM, Top Eleven, ManagerZone, OFM); el pack completo de Knight FM (subasta + directa + préstamo + cláusula + agente libre) supera el estándar.
3. **Canteras/scouting juvenil** — universal (Top Eleven tokens, Hattrick agentes, OFM); Knight FM lo tiene con scout sessions diarias.
4. **3D match engine** — estándar en líderes móviles (Top Eleven "advanced 3D live match engine") y PC (FM26 Unity, Anstoss); los MMO veterano (Hattrick, OSM) siguen con texto/sim — **un 3D no es requisito para competir en MMO**.
5. **Móvil primero** — Top Eleven/OSM/OFM viven en app; los MMO de navegador sufren en móvil (oportunidad: responsive premium de Knight FM).
6. **Licencias reales** — ventaja de FM26 (Premier League) y WAF (Bundesliga); los MMO suelen usar jugadores ficticios por coste (Knight FM incluido — normal en su segmento).
7. **Economía real / depositable** — nicho emergente: Soccerverse (XAYA/Polygon), Striker Manager 3 (P2E), GoalTycoon; Knight FM con Solana + oráculo $Knight/USD es pionero en UX web clásica; **nadie del mainstream lo ofrece**.
8. **Anti-cheat/economía íntegra** — dolor crónico (ManagerZone "cheaters/inflation", OSM P2W, Top Eleven sponsor-scam): el enfoque de Knight FM (1 cuenta/IP, ledger auditado, pentest) es un argumento de venta real.
9. **IA asistente** — casi inexistente como copiloto conversacional en el sector (Knight FM único con assistant read-only integrado).
10. **i18n** — OSM/Hattrick/Top Eleven multilenguaje amplio; en el nicho ES, Striker Manager domina el español (referencia para el ES-first de Knight FM).

## 4. Precios y monetización típica (resumen)
- **Premium PC:** FM26 $59.99 (con caídas a ~$23 en <3 meses); GOAL! y WAF con descuentos 50-80% — el precio pleno rara vez aguanta.
- **Suscripción supporter:** Hattrick Supporter (mensual, criticado por precio) — modelo clásico de MMO navegador.
- **F2P + IAP:** Top Eleven (tokens, sponsors especiales), OSM (Boss Coins + ads), OFM/SM (premium leve).
- **Economía real:** Striker Manager 3 y Soccerverse (crypto/P2E); Knight FM ($Knight vía Solana con retiro) — categoría casi vacía en UX mainstream.
- **Gratis con anuncios:** OSM es el ejemplo máximo (ad-first).
- **Gravámenes/leyves sobre ingresos de usuario:** patrón fiscal común (Top Eleven taxa ventas; Knight FM 10% levy) — aceptado socialmente si es transparente.

## 5. Tendencias del sector 2024–2025
1. **Crisis y reinicio del líder PC:** cancelación de FM25, salto a Unity de FM26 y recepción fría (~33% Steam) → ventana de oportunidad para MMO online ligeros y honestos.
2. **Live-service anualizado en móvil:** Top Eleven 2025→2026→2027, OSM 26/27: rebranding anual + battle pass/sponsor events como norma de retención.
3. **3D match engine como estándar de presentación móvil** (Top Eleven), aunque los MMO de texto persisten por fidelidad de comunidad (Hattrick).
4. **Economías de valor real en auge:** Soccerverse (seed $3.2M, on-chain), Striker Manager 3 (P2E), GoalTycoon→BuildTycoon — el dinero real en juegos de manager dejó de ser tabú; la confianza/seguridad es el bottleneck (Knight FM ya auditado).
5. **Roles económicos como gameplay:** Soccerverse (agente/trader/owner/scout) apunta a mercados de pases profundos, validando el diseño de mercado de Knight FM.
6. **Social como retención:** asociaciones de amigos (Top Eleven ≤5), federaciones (Hattrick), ligas con amigos (OSM) — Knight FM necesita capa social/clanes explícita para competir.
7. **Integridad anti-multicuenta como dolor no resuelto** en ManagerZone/OSM — diferenciador transversal para Knight FM.
8. **Femenino y licencias nuevas:** FM26 (fútbol femenino + Premier League), WAF (Bundesliga fem.), Hattrick Femme International — la inclusión de competiciones femeninas es tendencia ( posible roadmap Knight FM).

## 6. Insumo preliminar para la comparativa Knight FM (puntos ganadores / puntos perdedores)
**Puntos ganadores (vs. sector):**
- Mundo persistente único server-authoritative (Hattrick-style) con ritmo diario real — nadie lo combina con economía depositable.
- Mercado de pases más completo del sector analizado (subasta+directa+préstamo+cláusula+FA) con contabilidad idempotente auditada.
- $Knight/Solana con oráculo de precio y retiros — único en el mainstream web.
- IA integrada (read-only) — sin equivalente en competidores.
- Seguridad: pentest ejecutado, 1 cuenta/IP, ledgers auditables (dolor crónico en ManagerZone/OSM/Top Eleven).
- i18n ES-first (nicho hispano desatendido salvo Striker Manager) + 4 idiomas.
- Onboarding sin wallet (a diferencia de Soccerverse) con depósito opcional.

**Puntos perdedores (riesgos vs. sector):**
- Sin 3D match engine (Top Eleven/FM26 lo normalizan visualmente) ni licencias reales (FM26 Premier League).
- Sin apps móviles nativas (el 80% del sector vive en app stores) — solo responsive web.
- Ritmo diario estricto (1 día = 24 h) puede sentirse lento vs. OSM/Top Eleven (varios partidos/hora) si el manager no tiene acciones asíncronas ricas.
- Sin batalla social explícita (asociaciones/clanes/federaciones) en el spec actual.
- Economía real = carga regulatoria/de confianza (KYC/AML, volatilidad $Knight) que F2P no carga; Soccerverse muestra que la masa crítica crypto es limitada.
- Escala: 1600 clubes vs. 300M registrados de Top Eleven — el crecimiento de comunidad es el verdadero reto, no el feature set.

---

### Nota metodológica
- 34 búsquedas web ejecutadas (s1–s34 en `/home/z/my-project/tool-results/research/`); el motor de búsqueda devolvió resultados de calidad variable (varias queries ruido), por lo que las cifras se apoyan en los snippets de fuentes nombradas (nordeus.com, techcrunch, gamesindustry.biz, gamedeveloper.com, hattrick.org, reddit, steam, gamepriceradar, strategygame.org, vcbacked, nftnewstoday, clarnium, blockchaingames.fun, stillfront, softonic, etc.).
- Cifras de usuarios/precios citadas con fecha de fuente; verificar en la fase de comparativa si se usan en material público.
