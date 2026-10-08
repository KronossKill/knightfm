import type { Dict } from "../../index";

// Knight FM — tactics namespace (Spanish, primary language; spec §33, §12).
export const dict: Dict = {
  // Chrome
  "tactics.title": "Pizarra táctica",
  "tactics.formation.label": "Formación",
  "tactics.tab.pitch": "Pizarra",
  "tactics.tab.squad": "Plantilla",
  "tactics.tab.analysis": "Análisis",

  // Possession view modes
  "tactics.view.combined": "Combinado",
  "tactics.view.inPossession": "Con balón",
  "tactics.view.outOfPossession": "Sin balón",
  "tactics.view.hint.combined": "Once al completo en sus posiciones base.",
  "tactics.view.hint.in": "Con balón: el bloque se estira hacia arriba y ataca por las bandas.",
  "tactics.view.hint.out": "Sin balón: bloque compacto cerca del área propia.",

  // Actions
  "tactics.action.auto": "Auto-completar",
  "tactics.auto.note": "Auto-completar pondera rol, táctica, estado físico, fatiga, familiaridad y equilibrio — nunca solo la mejor forma actual.",
  "tactics.action.save": "Guardar",
  "tactics.action.reset": "Deshacer",
  "tactics.dirty.aria": "Cambios sin guardar",
  "tactics.completeness.aria": "{filled} de {total} posiciones cubiertas",

  // Pitch & slots
  "tactics.pitch.aria": "Pizarra táctica interactiva. Pulsa una posición para asignar jugador.",
  "tactics.slot.occupied": "Posición {label}, ocupada por {name}",
  "tactics.slot.vacant": "Posición {label}, vacante",

  // Slot assignment dialog
  "tactics.dialog.title": "Asignar {label}",
  "tactics.dialog.assign": "Alinear",
  "tactics.dialog.unassign": "Dejar vacante",
  "tactics.filter.availableOnly": "Solo disponibles",
  "tactics.pos.GK": "Portero",
  "tactics.pos.DF": "Defensa",
  "tactics.pos.MF": "Medio",
  "tactics.pos.FW": "Delantero",
  "tactics.sort.fit": "Aptitud",
  "tactics.sort.ovr": "Media (OVR)",
  "tactics.sort.form": "Forma",
  "tactics.sort.fatigue": "Menor fatiga",
  "tactics.fit.percent": "{pct}% apt.",
  "tactics.group.outOfPosition": "Fuera de posición",

  // Player status
  "tactics.status.available": "Disponible",
  "tactics.status.injured": "Lesionado hasta {date}",
  "tactics.status.suspended": "Suspendido ({n})",
  "tactics.form.up": "Forma en alza",
  "tactics.form.down": "Forma en declive",
  "tactics.form.flat": "Forma estable",

  // Left panel: shortlist + comparison
  "tactics.bench.title": "Banquillo y suplentes",
  "tactics.compare.title": "Comparar jugadores",
  "tactics.compare.pickA": "Elegir como jugador A",
  "tactics.compare.pickB": "Elegir como jugador B",
  "tactics.attr.ovr": "Media",
  "tactics.attr.age": "Edad",
  "tactics.attr.form": "Forma",
  "tactics.attr.fatigue": "Fatiga",
  "tactics.attr.sharpness": "Ritmo",
  "tactics.attr.morale": "Moral",

  // Right panel: lineup summary
  "tactics.summary.title": "Resumen del once",
  "tactics.instructions.title": "Instrucciones",
  "tactics.formation.desc.4-4-2": "Dos líneas de cuatro y doble punta: equilibrio clásico, transiciones directas y presión por parejas.",
  "tactics.formation.desc.4-3-3": "Tres medios y tridente ofensivo: amplitud arriba, salida limpia desde atrás y presión alta.",
  "tactics.formation.desc.4-5-1": "Cinco medios con pivote: control del centro del campo y trabajo del delantero único.",
  "tactics.formation.desc.5-3-2": "Cinco defensas con carrileros: bloque replegado y contraataques con doble punta.",
  "tactics.formation.desc.5-4-1": "Cinco defensas y cuatro medios: solidez máxima y cierre de espacios interiores.",
  "tactics.formation.desc.3-4-3": "Tres centrales con carrileros ofensivos: superioridad en bandas y ataque agresivo.",
  "tactics.formation.desc.3-5-2": "Tres centrales y cinco medios: dominio del centro, alas por fuera y pareja de ataque.",
  "tactics.risks.title": "Riesgos",
  "tactics.risks.fatigue": "{n} jugadores con fatiga alta (>70)",
  "tactics.risks.injuredStarters": "{n} titulares no disponibles",
  "tactics.risks.incomplete": "Once incompleto ({filled}/{total})",
  "tactics.risks.none": "Sin riesgos destacados",
  "tactics.strengths.title": "Fortalezas",
  "tactics.strengths.avgOvr": "OVR medio de titulares",
  "tactics.strengths.avgFit": "Aptitud media del once",
  "tactics.coaching.title": "Lectura del cuerpo técnico",
  "tactics.coaching.naturalFit": "{n} jugadores en posición natural",
  "tactics.coaching.ovrGood": "OVR medio competitivo ({avg})",
  "tactics.coaching.ovrLow": "OVR medio bajo ({avg}) — considera rotar o reforzar",
  "tactics.coaching.fresh": "El once llega fresco al encuentro",
  "tactics.coaching.fatigueWarn": "{n} jugadores con fatiga alta — gestiona los minutos",
  "tactics.matchup.title": "Próximo rival",
  "tactics.matchup.placeholder": "Evalúa la alineación sin rival fijado todavía",

  // Toasts
  "tactics.toast.saved": "Alineación guardada",
  "tactics.toast.savedDesc": "Formación {formation} · {filled}/{total} posiciones",
  "tactics.toast.autoDone": "Auto-completado aplicado",
  "tactics.toast.autoDesc": "Once generado con el objetivo multi-factor y guardado",

  // ── Wave: manager-purchase / training sessions / youth gating / admin access / facility conditions ──
  "tactics.action.clear": "Limpiar",
  "tactics.toast.cleared": "Once limpiado. Guarda para confirmar el cambio.",
};
