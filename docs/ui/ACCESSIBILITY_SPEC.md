# KNIGHT FM — ACCESSIBILITY SPEC (WCAG 2.1 AA) (Task 91)

## 1. Implementado en el código (verificado)

- **Skip link** `#game-main` (visible al foco) en el shell.
- **Foco visible**: `focus-visible:ring-2 ring-ring` (+outline en inputs) en
  todos los interactivos; nunca `outline:none` sin sustituto.
- **Navegación completa por teclado**: paleta (flechas/Enter/Esc), reordenar
  widgets (Espacio+flechas, instrucciones anunciadas), menús Radix, diálogos con
  focus trap y retorno de foco.
- **ARIA**: `aria-current="page"` en navegación; `aria-label`/`aria-pressed` en
  toggles (ojo de contraseña, chinchetas, colapso); `aria-live="polite"` en
  estados de guardado del dashboard y contadores; `role="alert"` en errores;
  `aria-busy` en skeletons; `aria-keyshortcuts` en el botón ⌘K.
- **Anuncios dinámicos**: toasts (`useToast`), estado "Guardando…/Guardado",
  banners de mantenimiento (`role="alert"`).
- **Contraste AA**: tokens por tema verificados (THEMES_TOKENS §5); texto muted
  ≥4.5:1; nunca color-only (siempre icono/texto junto al color).
- **Touch targets ≥44px** en móvil (`min-h-11 min-w-11`, bottom bar 56px).
- **`prefers-reduced-motion`**: respetado (framer-motion `useReducedMotion` en
  landing; dnd-kit y Radix lo honran; countdowns no animan).
- **Formularios**: labels visibles, validación inline con mensajes claros,
  autocomplete correcto (`new-password`, `one-time-code`, `email`).
- **Idioma**: `lang` del documento dinámico; todo texto vía i18n ×4 (es/en/fr/pt).

## 2. Checklist por pantalla (regla de aceptación)

| Criterio | Cómo se verifica |
|----------|------------------|
| Operable 100% por teclado | Recorrer Tab sin ratón; paleta abre todo |
| Foco siempre visible y ordenado | Sin trampas de foco; retorno tras diálogo |
| Lectores de pantalla | roles/labels/live-regions presentes; sin divs clicables mudos |
| Contraste AA en 5 temas | tabla de pares en THEMES_TOKENS §5 |
| Reonly-color | iconos/texto acompañan cada estado |
| Zoom 200% | layout funciona (no fixed-px críticos) |
| Motion reducido | animaciones decorativas desactivadas |

## 3. Deudas registradas (honestidad)

- Subtítulos de vídeo/audio ×4: no existe contenido audiovisual aún; cuando se
  añada, exigir `.vtt` ×4 como parte de la definición de hecho.
- Auditoría automática (axe/Lighthouse) recomendada en CI — manual ejecutada en
  E2E del navegador (foco, teclado, labels) en Task 91.
