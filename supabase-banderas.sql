-- ============================================================
-- Knight FM — Banderas de país de los managers conectados
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Es idempotente: se puede ejecutar varias veces sin daño.
-- ============================================================

ALTER TABLE "IpLink"   ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE "Presence" ADD COLUMN IF NOT EXISTS country TEXT;

-- Verificación: deben salir 2 filas con la columna country
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('IpLink', 'Presence')
  AND column_name = 'country';
