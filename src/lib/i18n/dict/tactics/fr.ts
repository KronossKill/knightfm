import type { Dict } from "../../index";

// Knight FM — tactics namespace (French; spec §33, §12).
export const dict: Dict = {
  // Chrome
  "tactics.title": "Tableau tactique",
  "tactics.formation.label": "Formation",
  "tactics.tab.pitch": "Terrain",
  "tactics.tab.squad": "Effectif",
  "tactics.tab.analysis": "Analyse",

  // Possession view modes
  "tactics.view.combined": "Combiné",
  "tactics.view.inPossession": "Avec ballon",
  "tactics.view.outOfPossession": "Sans ballon",
  "tactics.view.hint.combined": "Onze complet en positions de base.",
  "tactics.view.hint.in": "Avec ballon : le bloc monte et attaque par les ailes.",
  "tactics.view.hint.out": "Sans ballon : bloc compact près de notre surface.",

  // Actions
  "tactics.action.auto": "Auto-compléter",
  "tactics.auto.note": "L'auto-complétion pondère rôle, tactique, condition physique, fatigue, familiarité et équilibre — jamais la seule forme du moment.",
  "tactics.action.save": "Enregistrer",
  "tactics.action.reset": "Annuler",
  "tactics.dirty.aria": "Modifications non enregistrées",
  "tactics.completeness.aria": "{filled} postes sur {total} pourvus",

  // Pitch & slots
  "tactics.pitch.aria": "Tableau tactique interactif. Appuyez sur un poste pour assigner un joueur.",
  "tactics.slot.occupied": "Poste {label}, occupé par {name}",
  "tactics.slot.vacant": "Poste {label}, vacant",

  // Slot assignment dialog
  "tactics.dialog.title": "Assigner {label}",
  "tactics.dialog.assign": "Aligner",
  "tactics.dialog.unassign": "Laisser vacant",
  "tactics.filter.availableOnly": "Disponibles uniquement",
  "tactics.pos.GK": "Gardien",
  "tactics.pos.DF": "Défenseur",
  "tactics.pos.MF": "Milieu",
  "tactics.pos.FW": "Attaquant",
  "tactics.sort.fit": "Aptitude",
  "tactics.sort.ovr": "Moyenne (OVR)",
  "tactics.sort.form": "Forme",
  "tactics.sort.fatigue": "Moins de fatigue",
  "tactics.fit.percent": "{pct}% apt.",
  "tactics.group.outOfPosition": "Hors position",

  // Player status
  "tactics.status.available": "Disponible",
  "tactics.status.injured": "Blessé jusqu'au {date}",
  "tactics.status.suspended": "Suspendu ({n})",
  "tactics.form.up": "Forme en hausse",
  "tactics.form.down": "Forme en baisse",
  "tactics.form.flat": "Forme stable",

  // Left panel: shortlist + comparison
  "tactics.bench.title": "Banc et remplaçants",
  "tactics.compare.title": "Comparer des joueurs",
  "tactics.compare.pickA": "Choisir comme joueur A",
  "tactics.compare.pickB": "Choisir comme joueur B",
  "tactics.attr.ovr": "Moyenne",
  "tactics.attr.age": "Âge",
  "tactics.attr.form": "Forme",
  "tactics.attr.fatigue": "Fatigue",
  "tactics.attr.sharpness": "Rythme",
  "tactics.attr.morale": "Moral",

  // Right panel: lineup summary
  "tactics.summary.title": "Résumé du onze",
  "tactics.instructions.title": "Consignes",
  "tactics.formation.desc.4-4-2": "Deux lignes de quatre et une double pointe : équilibre classique, transitions directes et pressing en binôme.",
  "tactics.formation.desc.4-3-3": "Trois milieux et un trio offensif : largeur devant, relance propre et pressing haut.",
  "tactics.formation.desc.4-5-1": "Cinq milieux avec un pivot : contrôle du milieu et travail de l'attaquant solitaire.",
  "tactics.formation.desc.5-3-2": "Cinq défenseurs avec pistons : bloc bas et contres par la double pointe.",
  "tactics.formation.desc.5-4-1": "Cinq défenseurs et quatre milieux : solidité maximale et couloirs centraux fermés.",
  "tactics.formation.desc.3-4-3": "Trois centraux avec pistons offensifs : supériorité dans les couloirs et attaque agressive.",
  "tactics.formation.desc.3-5-2": "Trois centraux et cinq milieux : domination axiale, ailes dépassantes et double pointe.",
  "tactics.risks.title": "Risques",
  "tactics.risks.fatigue": "{n} joueurs très fatigués (>70)",
  "tactics.risks.injuredStarters": "{n} titulaires indisponibles",
  "tactics.risks.incomplete": "Onze incomplet ({filled}/{total})",
  "tactics.risks.none": "Aucun risque notable",
  "tactics.strengths.title": "Points forts",
  "tactics.strengths.avgOvr": "OVR moyen des titulaires",
  "tactics.strengths.avgFit": "Aptitude moyenne du onze",
  "tactics.coaching.title": "Lecture du staff technique",
  "tactics.coaching.naturalFit": "{n} joueurs à leur poste naturel",
  "tactics.coaching.ovrGood": "OVR moyen compétitif ({avg})",
  "tactics.coaching.ovrLow": "OVR moyen faible ({avg}) — envisagez de faire tourner ou renforcer",
  "tactics.coaching.fresh": "Le onze arrive frais pour le match",
  "tactics.coaching.fatigueWarn": "{n} joueurs très fatigués — gérez leurs minutes",
  "tactics.matchup.title": "Prochain adversaire",
  "tactics.matchup.placeholder": "Évaluation de l'alignement sans adversaire désigné",

  // Toasts
  "tactics.toast.saved": "Alignement enregistré",
  "tactics.toast.savedDesc": "Formation {formation} · {filled}/{total} postes",
  "tactics.toast.autoDone": "Auto-complétion appliquée",
  "tactics.toast.autoDesc": "Onze généré avec l'objectif multi-facteurs et enregistré",

  // ── Wave: manager-purchase / training sessions / youth gating / admin access / facility conditions ──
  "tactics.action.clear": "Vider",
  "tactics.toast.cleared": "Onze vidé. Enregistrez pour confirmer.",
};
