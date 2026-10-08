import type { Dict } from "../../index";

// Knight FM — tactics namespace (Portuguese; spec §33, §12).
export const dict: Dict = {
  // Chrome
  "tactics.title": "Quadro tático",
  "tactics.formation.label": "Formação",
  "tactics.tab.pitch": "Quadro",
  "tactics.tab.squad": "Plantel",
  "tactics.tab.analysis": "Análise",

  // Possession view modes
  "tactics.view.combined": "Combinado",
  "tactics.view.inPossession": "Com bola",
  "tactics.view.outOfPossession": "Sem bola",
  "tactics.view.hint.combined": "Onze completo nas posições de base.",
  "tactics.view.hint.in": "Com bola: o bloco sobe e ataca pelos corredores laterais.",
  "tactics.view.hint.out": "Sem bola: bloco compacto perto da nossa área.",

  // Actions
  "tactics.action.auto": "Preencher automaticamente",
  "tactics.auto.note": "O preenchimento automático pondera função, tática, condição física, fadiga, familiaridade e equilíbrio — nunca apenas a melhor fase atual.",
  "tactics.action.save": "Guardar",
  "tactics.action.reset": "Desfazer",
  "tactics.dirty.aria": "Alterações não guardadas",
  "tactics.completeness.aria": "{filled} de {total} posições preenchidas",

  // Pitch & slots
  "tactics.pitch.aria": "Quadro tático interativo. Toque numa posição para atribuir um jogador.",
  "tactics.slot.occupied": "Posição {label}, ocupada por {name}",
  "tactics.slot.vacant": "Posição {label}, vaga",

  // Slot assignment dialog
  "tactics.dialog.title": "Atribuir {label}",
  "tactics.dialog.assign": "Escalar",
  "tactics.dialog.unassign": "Deixar vaga",
  "tactics.filter.availableOnly": "Apenas disponíveis",
  "tactics.pos.GK": "Guarda-redes",
  "tactics.pos.DF": "Defesa",
  "tactics.pos.MF": "Médio",
  "tactics.pos.FW": "Avançado",
  "tactics.sort.fit": "Aptidão",
  "tactics.sort.ovr": "Média (OVR)",
  "tactics.sort.form": "Forma",
  "tactics.sort.fatigue": "Menor fadiga",
  "tactics.fit.percent": "{pct}% apt.",
  "tactics.group.outOfPosition": "Fora de posição",

  // Player status
  "tactics.status.available": "Disponível",
  "tactics.status.injured": "Lesionado até {date}",
  "tactics.status.suspended": "Suspenso ({n})",
  "tactics.form.up": "Forma em alta",
  "tactics.form.down": "Forma em baixa",
  "tactics.form.flat": "Forma estável",

  // Left panel: shortlist + comparison
  "tactics.bench.title": "Banco e suplentes",
  "tactics.compare.title": "Comparar jogadores",
  "tactics.compare.pickA": "Escolher como jogador A",
  "tactics.compare.pickB": "Escolher como jogador B",
  "tactics.attr.ovr": "Média",
  "tactics.attr.age": "Idade",
  "tactics.attr.form": "Forma",
  "tactics.attr.fatigue": "Fadiga",
  "tactics.attr.sharpness": "Ritmo",
  "tactics.attr.morale": "Moral",

  // Right panel: lineup summary
  "tactics.summary.title": "Resumo do onze",
  "tactics.instructions.title": "Instruções",
  "tactics.formation.desc.4-4-2": "Duas linhas de quatro e dupla de ataque: equilíbrio clássico, transições diretas e pressão em pares.",
  "tactics.formation.desc.4-3-3": "Três médios e trio ofensivo: amplitude na frente, saída limpa de trás e pressão alta.",
  "tactics.formation.desc.4-5-1": "Cinco médios com pivô: controlo do meio-campo e trabalho do avançado isolado.",
  "tactics.formation.desc.5-3-2": "Cinco defesas com alas: bloco recolhido e contra-ataques com a dupla de ataque.",
  "tactics.formation.desc.5-4-1": "Cinco defesas e quatro médios: solidez máxima e corredores centrais fechados.",
  "tactics.formation.desc.3-4-3": "Três centrais com alas ofensivas: superioridade lateral e ataque agressivo.",
  "tactics.formation.desc.3-5-2": "Três centrais e cinco médios: domínio central, alas por fora e dupla de ataque.",
  "tactics.risks.title": "Riscos",
  "tactics.risks.fatigue": "{n} jogadores com fadiga alta (>70)",
  "tactics.risks.injuredStarters": "{n} titulares indisponíveis",
  "tactics.risks.incomplete": "Onze incompleto ({filled}/{total})",
  "tactics.risks.none": "Sem riscos relevantes",
  "tactics.strengths.title": "Pontos fortes",
  "tactics.strengths.avgOvr": "OVR médio dos titulares",
  "tactics.strengths.avgFit": "Aptidão média do onze",
  "tactics.coaching.title": "Leitura da comissão técnica",
  "tactics.coaching.naturalFit": "{n} jogadores na posição natural",
  "tactics.coaching.ovrGood": "OVR médio competitivo ({avg})",
  "tactics.coaching.ovrLow": "OVR médio baixo ({avg}) — considera rodar ou reforçar",
  "tactics.coaching.fresh": "O onze chega fresco para a partida",
  "tactics.coaching.fatigueWarn": "{n} jogadores com fadiga alta — gere os minutos",
  "tactics.matchup.title": "Próximo adversário",
  "tactics.matchup.placeholder": "Avaliação do onze sem adversário definido",

  // Toasts
  "tactics.toast.saved": "Onze guardado",
  "tactics.toast.savedDesc": "Formação {formation} · {filled}/{total} posições",
  "tactics.toast.autoDone": "Preenchimento automático aplicado",
  "tactics.toast.autoDesc": "Onze gerado com o objetivo multi-fator e guardado",

  // ── Wave: manager-purchase / training sessions / youth gating / admin access / facility conditions ──
  "tactics.action.clear": "Limpar",
  "tactics.toast.cleared": "Time limpo. Salve para confirmar a mudança.",
};
