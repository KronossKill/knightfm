// Knight FM — account lifecycle & season anchor (ES primary, Task 25-a).

export const dict: Record<string, string> = {
  // ── Season anchor (world clock) ─────────────────────────────────
  "lifecycle.season.title": "Inicio del mundo (ancla de la 1ª temporada)",
  "lifecycle.season.desc":
    "El día 1 del mundo arranca en esta fecha UTC. Fijar el ancla redefine el contador de días de juego: úsalo solo para corregir el inicio de la 1ª temporada.",
  "lifecycle.season.currentAnchor": "Ancla actual (UTC)",
  "lifecycle.season.gameDay": "Día de juego actual",
  "lifecycle.season.activeSeason": "Temporada activa",
  "lifecycle.season.seasonN": "Temporada {n}",
  "lifecycle.season.none": "Sin temporada activa",
  "lifecycle.season.dateLabel": "Nueva fecha de inicio (UTC)",
  "lifecycle.season.setButton": "Fijar inicio de la 1ª temporada",
  "lifecycle.season.setDone": "Mundo anclado al {date}. Día de juego actual: {day}.",
  "lifecycle.season.forceTitle": "¿Re-anclar el mundo?",
  "lifecycle.season.forceDesc":
    "Ya existen temporadas. Re-anclar reinicia el contador de días del mundo y remapea la temporada en curso, los calendarios y los contratos. La acción queda registrada en la auditoría.",
  "lifecycle.season.forceCheck": "Entiendo, re-anclar",
  "lifecycle.season.forceConfirm": "Re-anclar el mundo",
  "lifecycle.season.error": "No se pudo fijar el ancla del mundo",

  // ── Inactivity policy ──────────────────────────────────────────
  "lifecycle.inactivity.title": "Ciclo de vida de las cuentas",
  "lifecycle.inactivity.desc":
    "Trabajo diario (00:20 UTC): las cuentas sin accesos se marcan INACTIVAS y después se depuran. Los clubes de propietarios borrados vuelven al sistema con su nombre original; los clubes dirigidos pierden al mánager y su contrato se termina.",
  "lifecycle.inactivity.policy":
    "Cuentas: INACTIVA a los {a} días, borrada a los {b} — los administradores nunca caducan.",
  "lifecycle.inactivity.policyUnknown":
    "Las cuentas sin actividad se marcan INACTIVAS y luego se borran; los administradores nunca caducan.",
};
