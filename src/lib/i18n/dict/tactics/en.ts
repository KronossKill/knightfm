import type { Dict } from "../../index";

// Knight FM — tactics namespace (English; spec §33, §12).
export const dict: Dict = {
  // Chrome
  "tactics.title": "Tactical board",
  "tactics.formation.label": "Formation",
  "tactics.tab.pitch": "Board",
  "tactics.tab.squad": "Squad",
  "tactics.tab.analysis": "Analysis",

  // Possession view modes
  "tactics.view.combined": "Combined",
  "tactics.view.inPossession": "In possession",
  "tactics.view.outOfPossession": "Out of possession",
  "tactics.view.hint.combined": "Full XI at base positions.",
  "tactics.view.hint.in": "In possession: the block pushes up and attacks through the wings.",
  "tactics.view.hint.out": "Out of possession: compact block near our own box.",

  // Actions
  "tactics.action.auto": "Auto-complete",
  "tactics.auto.note": "Auto-complete weighs role, tactics, fitness, fatigue, familiarity and balance — never best current form alone.",
  "tactics.action.save": "Save",
  "tactics.action.reset": "Revert",
  "tactics.dirty.aria": "Unsaved changes",
  "tactics.completeness.aria": "{filled} of {total} positions covered",

  // Pitch & slots
  "tactics.pitch.aria": "Interactive tactical board. Press a position to assign a player.",
  "tactics.slot.occupied": "Position {label}, occupied by {name}",
  "tactics.slot.vacant": "Position {label}, vacant",

  // Slot assignment dialog
  "tactics.dialog.title": "Assign {label}",
  "tactics.dialog.assign": "Line up",
  "tactics.dialog.unassign": "Leave vacant",
  "tactics.filter.availableOnly": "Available only",
  "tactics.pos.GK": "Goalkeeper",
  "tactics.pos.DF": "Defender",
  "tactics.pos.MF": "Midfielder",
  "tactics.pos.FW": "Forward",
  "tactics.sort.fit": "Suitability",
  "tactics.sort.ovr": "Rating (OVR)",
  "tactics.sort.form": "Form",
  "tactics.sort.fatigue": "Lowest fatigue",
  "tactics.fit.percent": "{pct}% fit",
  "tactics.group.outOfPosition": "Out of position",

  // Player status
  "tactics.status.available": "Available",
  "tactics.status.injured": "Injured until {date}",
  "tactics.status.suspended": "Suspended ({n})",
  "tactics.form.up": "Form rising",
  "tactics.form.down": "Form dipping",
  "tactics.form.flat": "Form steady",

  // Left panel: shortlist + comparison
  "tactics.bench.title": "Bench & reserves",
  "tactics.compare.title": "Compare players",
  "tactics.compare.pickA": "Pick as player A",
  "tactics.compare.pickB": "Pick as player B",
  "tactics.attr.ovr": "Rating",
  "tactics.attr.age": "Age",
  "tactics.attr.form": "Form",
  "tactics.attr.fatigue": "Fatigue",
  "tactics.attr.sharpness": "Sharpness",
  "tactics.attr.morale": "Morale",

  // Right panel: lineup summary
  "tactics.summary.title": "Lineup summary",
  "tactics.instructions.title": "Instructions",
  "tactics.formation.desc.4-4-2": "Two banks of four and a strike pair: classic balance, direct transitions and paired pressing.",
  "tactics.formation.desc.4-3-3": "Three midfielders and a front three: width up top, clean build-up from the back and a high press.",
  "tactics.formation.desc.4-5-1": "Five midfielders with a pivot: midfield control and a lone striker's work rate.",
  "tactics.formation.desc.5-3-2": "Five at the back with wing-backs: low block and counterattacks through the strike pair.",
  "tactics.formation.desc.5-4-1": "Five defenders and four midfielders: maximum solidity and closed central lanes.",
  "tactics.formation.desc.3-4-3": "Three centre-backs with attacking wing-backs: wide overloads and aggressive attacking.",
  "tactics.formation.desc.3-5-2": "Three centre-backs and five midfielders: central dominance, wide wing-backs and a strike pair.",
  "tactics.risks.title": "Risks",
  "tactics.risks.fatigue": "{n} players with high fatigue (>70)",
  "tactics.risks.injuredStarters": "{n} starters unavailable",
  "tactics.risks.incomplete": "Incomplete XI ({filled}/{total})",
  "tactics.risks.none": "No major risks",
  "tactics.strengths.title": "Strengths",
  "tactics.strengths.avgOvr": "Starters' average OVR",
  "tactics.strengths.avgFit": "Lineup average suitability",
  "tactics.coaching.title": "Coaching feedback",
  "tactics.coaching.naturalFit": "{n} players in their natural position",
  "tactics.coaching.ovrGood": "Competitive average OVR ({avg})",
  "tactics.coaching.ovrLow": "Low average OVR ({avg}) — consider rotating or reinforcing",
  "tactics.coaching.fresh": "The XI arrives fresh for the match",
  "tactics.coaching.fatigueWarn": "{n} players with high fatigue — manage their minutes",
  "tactics.matchup.title": "Next opponent",
  "tactics.matchup.placeholder": "Evaluating the lineup without a set opponent yet",

  // Toasts
  "tactics.toast.saved": "Lineup saved",
  "tactics.toast.savedDesc": "Formation {formation} · {filled}/{total} positions",
  "tactics.toast.autoDone": "Auto-complete applied",
  "tactics.toast.autoDesc": "XI generated with the multi-factor objective and saved",

  // ── Wave: manager-purchase / training sessions / youth gating / admin access / facility conditions ──
  "tactics.action.clear": "Clear",
  "tactics.toast.cleared": "Lineup cleared. Save to confirm the change.",
};
