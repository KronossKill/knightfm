-- Knight FM — Task 77: salario semanal fijo (domingos 01:00 hora del servidor/UTC)
-- HIGIENE: la configuración "finance.salaryIntervalDays" quedó obsoleta (el
-- horario de pago ya NO es configurable: es fijo, cada domingo 01:00 UTC).
-- Esta línea elimina la fila vieja para que no aparezca en el Panel de Control.
-- IDEMPOTENTE: se puede ejecutar varias veces sin efecto duplicado.

DELETE FROM "ConfigKey" WHERE key = 'finance.salaryIntervalDays';
