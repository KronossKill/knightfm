# ADR-001 — Candado de Next.js: 16.1.3 → 16.4.0 exacto

- **Estado:** Aceptado (supersede parcial del candado 16.1.3 de Task 90)
- **Fecha:** 2026-10-11 · **Ciclo:** Task 94 (Master Prompt Unificado)
- **Contexto:** el Master Prompt exige «affected dependencies → latest stable».
  Next 16.1.3 quedó anclado en la recuperación de Task 90 porque era la versión
  que `bun.lock` acreditaba tras la 2ª reversión total. Next **16.4.0** es la
  minor estable vigente en la línea 16 (React 19.3, Turbopack por defecto,
  eslint-config-next 16.4.0 alineado).
- **Decisión:** anclar `next: "16.4.0"` EXACTO (sin ^) en el package.json
  entregado, con el builder auditando el candado in-zip (probe actualizado).
- **Consecuencias positivas:** parches de seguridad y rendimiento de 3 minors;
  Turbopack dev más rápido; config de eslint oficial 16.4 sin conflictos.
- **Consecuencias a vigilar:** aviso de deprecación `middleware` → `proxy`
  (migración pendiente con codemod oficial; NO bloquea).
- **Verificación de esta decisión:** dev Ready en 307 ms con Turbopack 16.4.0,
  GET / 200, lint verde, E2E del panel de descargas sin errores de consola,
  build KFM-OPS-015 verde con el probe 16.4.0.
- **Rollback:** `git revert` del commit del ciclo + `bun install` (el candado
  anterior queda en el historial y en el backup phase0).
