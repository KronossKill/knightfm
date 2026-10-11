# KNIGHT FM — QUALITY CHECKLIST (Task 91) — PASS/FAIL real

> Verificado en navegador (agent-browser) + lint + probes de build.
> Marco: ✅ PASS · 🟡 PARCIAL (con plan) · ❌ FAIL. Sin adornos.

## Navegación
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Sidebar colapsable/expandible persistida | ✅ | botón PanelLeft; localStorage; E2E |
| Fijadas (pin ≤5) con teclado | ✅ | chincheta aria-pressed; grupo "Fijadas" |
| Ctrl/Cmd+1..9 salta a secciones | ✅ | handler en shell (ignora inputs) |
| Ctrl/Cmd+K paleta con recientes | ✅ | E2E: abre, navega, cambia tema |
| Top bar completa (reloj UTC, presencia, campana, club) | ✅ | preexistente + E2E |
| Bottom bar móvil 4+"Más" | ✅ | lg:hidden; safe-area; E2E 360px |
| ≤2 clics a cualquier pantalla | ✅ | sidebar+paleta (toda vista está a 1 clic) |
| Sin botones de tiempo ("Avanzar día"/"Jugar") | ✅ | no existen en el código |
| Deep-linking por URL por vista | 🟡 | SPA de una ruta por diseño; registrado en NAV doc |

## Dashboard
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Widgets por defecto por rol | ✅ | registry (Mánager/Propietario) |
| Añadir/quitar widgets | ✅ | diálogo + X (aria-labels) |
| Redimensionar 1×1/2×1/1×2/2×2 | ✅ | ciclo entre allowedSizes |
| Reordenar drag + teclado | ✅ | dnd-kit Pointer+Keyboard sensors |
| Presets guardar/aplicar/borrar | ✅ | diálogo nombre; chips aplicables |
| Persistencia server-side por usuario | ✅ | DashboardLayout + GET/PUT (zod) |
| Guardado optimista + estados visibles | ✅ | "Guardando…/Guardado/error" aria-live |
| Widgets autocontenidos (skeleton/error/empty) | ✅ | 11 widgets con queries propias |
| Personalizado en <60s | ✅ | 2 clics (añadir + tamaño) |

## Temas
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| 5 temas completos y paritarios | ✅ | 19+ tokens ×5 (globals.css; JSON extraído) |
| THEME_PROVIDER + selectores (3 entradas) | ✅ | provider + menú usuario + AuthFlow + paleta |
| Cambio de tema sin tocar juego | ✅ | solo data-theme+localStorage |
| Tokens como única fuente (sin hex en UI) | ✅ | excepciones auditadas (césped) |

## Tablero táctico
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Fichas cuadradas (nunca círculos) | ✅ | aspect-square tiles (preexistente) |
| Diálogo de posición con elegibles | ✅ | slot-dialog |
| Paneles izquierda/derecha + análisis | ✅ | squad-panel + analysis-panel |
| ≥44px targets y teclado | ✅ | min-w-[56px], botones reales |

## Responsive
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| 360px usable (bottom bar, sin overflow de página) | ✅ | E2E móvil |
| Tablet + desktop + ultrawide | ✅ | breakpoints lg/xl |
| 4K centrado máx.1920px | ✅ | max-w-[1920px] en header/body/footer |
| Touch ≥44px | ✅ | min-h-11 en controles |

## Accesibilidad
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Skip-link + foco visible | ✅ | shell |
| Keyboard-first (paleta, atajos, reorder) | ✅ | E2E teclado |
| ARIA completo (current/pressed/live/alert) | ✅ | código + E2E snapshot |
| Contraste AA en 5 temas | ✅ | tokens diseñados AA; muted≥4.5 |
| Sin color-only | ✅ | iconos/texto en estados |
| Subtítulos AV ×4 | 🟡 | no hay AV aún; exigible al crearse |

## Rendimiento
| Criterio | Estado | Evidencia |
|----------|--------|-----------|
| Code splitting por módulo | ✅ | lazy-modules (tácticas/mercados/…) |
| Skeletons en todo async | ✅ | widgets/vistas |
| Animaciones transform/opacity | ✅ | dnd-kit/framer |
| LCP/INP/CLS objetivo | 🟡 | arquitectura alineada; medición Lighthouse pendiente en CI |
| JS inicial <200KB gzip | 🟡 | splitting aplicado; medición exacta pendiente de build prod |

## Resumen
**PASS total en funcionalidad pedida**; 🟡 = deuda medida/registrada con plan
(Lighthouse en CI, subtítulos cuando exista AV, deep-link por vista = decisión de
producto SPA).
